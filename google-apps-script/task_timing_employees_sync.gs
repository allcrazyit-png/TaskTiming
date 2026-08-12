/**
 * Manual employee sync for the bound spreadsheet.
 *
 * Employee names are mirrored to a public read-only Supabase table. Passwords
 * are sent only to Supabase Auth Admin and are never included in that table.
 */
var TASK_TIMING_EMPLOYEE_SYNC_BATCH_SIZE = 200;

function normalizeTaskTimingHeaders_(headers) {
  return headers.map(function (header) {
    return String(header).replace(/\[.*?\]/g, '').trim();
  });
}

function employeeRowToTaskTimingEmployee_(headers, row) {
  var source = {};
  headers.forEach(function (header, index) {
    source[String(header).trim()] = row[index];
  });

  var rawEmployeeId = source['員工編號'];
  var rawEmployeeName = source['姓名'];
  var employeeId = String(rawEmployeeId === null || rawEmployeeId === undefined ? '' : rawEmployeeId).trim();
  var employeeName = String(rawEmployeeName === null || rawEmployeeName === undefined ? '' : rawEmployeeName).trim();
  if (!employeeId || !employeeName) return null;

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    password: String(source['密碼'] || ''),
  };
}

// Must remain byte-for-byte compatible in behavior with the browser helper.
function taskTimingEmployeeAuthEmail_(employeeId) {
  var id = String(employeeId === null || employeeId === undefined ? '' : employeeId).trim().toLowerCase();
  if (!id) throw new Error('Employee ID is required');
  return encodeURIComponent(id) + '@tasktiming.local';
}

function taskTimingSupabaseRequest_(endpoint, options, description) {
  var response = UrlFetchApp.fetch(endpoint, options);
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(description + ' failed (' + status + ')');
  }
  return response;
}

function taskTimingExistingEmployees_(baseUrl, secret) {
  var employees = { byEmployeeId: {}, employeeIdByAuthUserId: {} };
  var start = 0;
  var pageSize = 1000;

  while (true) {
    var response = taskTimingSupabaseRequest_(
      baseUrl + '/rest/v1/task_timing_employees?select=employee_id,auth_user_id&order=employee_id.asc',
      {
        method: 'get',
        headers: {
          apikey: secret,
          Authorization: 'Bearer ' + secret,
          Range: start + '-' + (start + pageSize - 1),
        },
        muteHttpExceptions: true,
      },
      '讀取既有員工資料',
    );
    var rows = JSON.parse(response.getContentText() || '[]');
    rows.forEach(function (row) {
      if (row.employee_id && row.auth_user_id) {
        var employeeId = String(row.employee_id);
        var authUserId = String(row.auth_user_id);
        employees.byEmployeeId[employeeId] = authUserId;
        employees.employeeIdByAuthUserId[authUserId] = employeeId;
      }
    });
    if (rows.length < pageSize) break;
    start += pageSize;
  }

  return employees;
}

// An Auth user can exist even if a prior run failed before the public mirror
// was written. Looking it up by the canonical email makes reruns idempotent.
function taskTimingAuthUsersByEmail_(baseUrl, secret) {
  var usersByEmail = {};
  var page = 1;
  var pageSize = 1000;

  while (true) {
    var response = taskTimingSupabaseRequest_(
      baseUrl + '/auth/v1/admin/users?page=' + page + '&per_page=' + pageSize,
      {
        method: 'get',
        headers: { apikey: secret, Authorization: 'Bearer ' + secret },
        muteHttpExceptions: true,
      },
      '讀取既有 Auth 帳號',
    );
    var body = JSON.parse(response.getContentText() || '{}');
    var users = Array.isArray(body) ? body : (body.users || []);
    users.forEach(function (user) {
      if (user.id && user.email) {
        usersByEmail[String(user.email).trim().toLowerCase()] = {
          id: String(user.id),
          employee_id: user.user_metadata && user.user_metadata.employee_id !== undefined && user.user_metadata.employee_id !== null
            ? String(user.user_metadata.employee_id)
            : '',
        };
      }
    });
    if (users.length < pageSize) break;
    page += 1;
  }

  return usersByEmail;
}

function taskTimingProvisionEmployeeAuth_(baseUrl, secret, employee, authUserId) {
  var userPayload = {
    user_metadata: {
      employee_id: employee.employee_id,
      employee_name: employee.employee_name,
    },
  };

  if (authUserId) {
    if (employee.password) userPayload.password = employee.password;
    taskTimingSupabaseRequest_(
      baseUrl + '/auth/v1/admin/users/' + encodeURIComponent(authUserId),
      {
        method: 'put',
        contentType: 'application/json',
        headers: { apikey: secret, Authorization: 'Bearer ' + secret },
        payload: JSON.stringify(userPayload),
        muteHttpExceptions: true,
      },
      '更新員工 Auth 帳號',
    );
    return { auth_user_id: authUserId, created: false };
  }

  if (!employee.password) throw new Error('新員工必須填寫密碼');
  userPayload.email = taskTimingEmployeeAuthEmail_(employee.employee_id);
  userPayload.email_confirm = true;
  userPayload.password = employee.password;
  var response = taskTimingSupabaseRequest_(
    baseUrl + '/auth/v1/admin/users',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: secret, Authorization: 'Bearer ' + secret },
      payload: JSON.stringify(userPayload),
      muteHttpExceptions: true,
    },
    '建立員工 Auth 帳號',
  );
  var user = JSON.parse(response.getContentText() || '{}');
  if (!user.id) throw new Error('建立員工 Auth 帳號 failed (missing user ID)');
  return { auth_user_id: String(user.id), created: true };
}

function taskTimingUpsertEmployeeBatch_(baseUrl, secret, rows) {
  taskTimingSupabaseRequest_(
    baseUrl + '/rest/v1/task_timing_employees?on_conflict=employee_id',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: secret,
        Authorization: 'Bearer ' + secret,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      payload: JSON.stringify(rows),
      muteHttpExceptions: true,
    },
    '寫入員工鏡像',
  );
}

function syncTaskTimingEmployeesToSupabase() {
  var alertShown = false;
  var ui = SpreadsheetApp.getUi();
  try {
    var properties = PropertiesService.getScriptProperties();
    var baseUrl = String(properties.getProperty('TASK_TIMING_SUPABASE_URL') || '').trim().replace(/\/$/, '');
    var secret = String(properties.getProperty('TASK_TIMING_SUPABASE_SECRET_KEY') || '').trim();
    if (!baseUrl) throw new Error('缺少 Script Property：TASK_TIMING_SUPABASE_URL');
    if (!secret) throw new Error('缺少 Script Property：TASK_TIMING_SUPABASE_SECRET_KEY');

    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet && spreadsheet.getSheetByName('員工資料');
    if (!sheet) throw new Error('找不到工作表：員工資料');

    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) throw new Error('員工資料工作表沒有可同步的資料');
    var headers = normalizeTaskTimingHeaders_(data[0]);
    if (headers.indexOf('員工編號') === -1) throw new Error('員工資料缺少必要欄位：員工編號');
    if (headers.indexOf('姓名') === -1) throw new Error('員工資料缺少必要欄位：姓名');

    var employees = data.slice(1).map(function (row) {
      return employeeRowToTaskTimingEmployee_(headers, row);
    }).filter(function (employee) {
      return employee !== null;
    });

    // Auth treats canonical emails as case-insensitive. Detect source IDs that
    // collapse to the same account before any Supabase request can mutate data.
    var sourceEmployeeIds = {};
    var duplicateEmployeeIds = [];
    employees.forEach(function (employee) {
      if (sourceEmployeeIds[employee.employee_id]) {
        if (duplicateEmployeeIds.indexOf(employee.employee_id) === -1) {
          duplicateEmployeeIds.push(employee.employee_id);
        }
        return;
      }
      sourceEmployeeIds[employee.employee_id] = true;
    });
    if (duplicateEmployeeIds.length) {
      throw new Error('員工編號重複：' + duplicateEmployeeIds.join('、'));
    }

    var sourceIdsByAuthEmail = {};
    var collisions = [];
    employees.forEach(function (employee) {
      var authEmail = taskTimingEmployeeAuthEmail_(employee.employee_id).toLowerCase();
      var firstEmployeeId = sourceIdsByAuthEmail[authEmail];
      if (firstEmployeeId && firstEmployeeId !== employee.employee_id) {
        if (collisions.indexOf(firstEmployeeId) === -1) collisions.push(firstEmployeeId);
        if (collisions.indexOf(employee.employee_id) === -1) collisions.push(employee.employee_id);
        return;
      }
      sourceIdsByAuthEmail[authEmail] = employee.employee_id;
    });
    if (collisions.length) {
      throw new Error('員工編號 Auth email 衝突：' + collisions.join('、'));
    }

    var existingEmployees = taskTimingExistingEmployees_(baseUrl, secret);
    var authUsersByEmail = taskTimingAuthUsersByEmail_(baseUrl, secret);
    var ownershipConflicts = [];
    employees.forEach(function (employee) {
      var authEmail = taskTimingEmployeeAuthEmail_(employee.employee_id).toLowerCase();
      var authUser = authUsersByEmail[authEmail];
      var mirrorAuthUserId = existingEmployees.byEmployeeId[employee.employee_id];
      var emailAuthUserId = authUser && authUser.id;
      var authUserId = mirrorAuthUserId || emailAuthUserId;
      var mirrorOwner = authUserId && existingEmployees.employeeIdByAuthUserId[authUserId];
      var hasAuthOwnerConflict = authUser && authUser.employee_id && authUser.employee_id !== employee.employee_id;
      var hasMirrorOwnerConflict = mirrorOwner && mirrorOwner !== employee.employee_id;
      // Both pointers must identify the same Auth user. Otherwise a PUT could
      // silently repair the wrong account or overwrite a different employee.
      var hasPointerConflict = mirrorAuthUserId && emailAuthUserId && mirrorAuthUserId !== emailAuthUserId;
      if ((hasAuthOwnerConflict || hasMirrorOwnerConflict || hasPointerConflict) && ownershipConflicts.indexOf(employee.employee_id) === -1) {
        ownershipConflicts.push(employee.employee_id);
      }
    });
    if (ownershipConflicts.length) {
      throw new Error('員工資料歸屬衝突：' + ownershipConflicts.join('、'));
    }
    var pending = [];
    var created = 0;
    var updated = 0;
    var failures = [];
    var seenIds = {};

    employees.forEach(function (employee) {
      if (seenIds[employee.employee_id]) {
        failures.push(employee.employee_id + '（重複員工編號）');
        return;
      }
      seenIds[employee.employee_id] = true;

      try {
        var authUser = authUsersByEmail[taskTimingEmployeeAuthEmail_(employee.employee_id).toLowerCase()];
        var existingAuthUserId = existingEmployees.byEmployeeId[employee.employee_id] || (authUser && authUser.id);
        // A blank password preserves existing Auth credentials, but a new Auth
        // account must never be created with an implicit/predictable password.
        if (!existingAuthUserId && !employee.password) {
          failures.push(employee.employee_id);
          return;
        }
        var provisioned = taskTimingProvisionEmployeeAuth_(
          baseUrl, secret, employee, existingAuthUserId,
        );
        pending.push({
          employee_id: employee.employee_id,
          employee_name: employee.employee_name,
          auth_user_id: provisioned.auth_user_id,
          source_updated_at: new Date().toISOString(),
          created: provisioned.created,
        });
      } catch (error) {
        failures.push(employee.employee_id);
      }
    });

    for (var start = 0; start < pending.length; start += TASK_TIMING_EMPLOYEE_SYNC_BATCH_SIZE) {
      var batch = pending.slice(start, start + TASK_TIMING_EMPLOYEE_SYNC_BATCH_SIZE);
      try {
        var mirrorRows = batch.map(function (row) {
          return {
            employee_id: row.employee_id,
            employee_name: row.employee_name,
            auth_user_id: row.auth_user_id,
            source_updated_at: row.source_updated_at,
          };
        });
        taskTimingUpsertEmployeeBatch_(baseUrl, secret, mirrorRows);
        batch.forEach(function (row) {
          if (row.created) created += 1;
          else updated += 1;
        });
      } catch (error) {
        batch.forEach(function (row) { failures.push(row.employee_id); });
      }
    }

    var message = '同步完成：新增 ' + created + ' 筆、更新 ' + updated + ' 筆、失敗 ' + failures.length + ' 筆。';
    if (failures.length) message += '\n失敗員工編號：' + failures.join('、');
    ui.alert(message);
    alertShown = true;
    if (failures.length) throw new Error('員工同步失敗：' + failures.join('、'));
    return { created: created, updated: updated, failed: 0 };
  } catch (error) {
    if (!alertShown) {
      ui.alert('同步失敗：' + (error && error.message ? error.message : String(error)));
    }
    throw error;
  }
}
