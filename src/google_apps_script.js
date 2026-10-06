const PRODUCTS_SS_ID = '1YSOI1VPh4GBYkr7QVx60YOxtrfpC4JofuXOy_dyPHaQ'; // 產品資料表 (讀)
const RECORDS_SS_ID = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw';  // 組裝紀錄表 (寫)
const TASK_TIMING_RECORD_ID_HEADER = 'Supabase紀錄ID';
const TASK_TIMING_SYNC_STATUS_HEADER = 'Supabase同步狀態';
const TASK_TIMING_RECORD_BATCH_SIZE = 1000;
const TASK_TIMING_UPSERT_BATCH_SIZE = 200;
const TASK_TIMING_DELETE_BATCH_SIZE = 100;

// 讀整張試算表在 GAS 上要 10～30 秒，但產品與員工資料一天內幾乎不變。
// 用 CacheService 把組好的 JSON 存起來，命中時直接回傳，可從 17 秒降到 1 秒內。
var CACHE_TTL_SECONDS = 600; // 10 分鐘

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('組裝報表工具')
        .addItem('建立今日提醒並設定自動同步', 'setupTaskTimingNoticeSync')
        .addItem('立即同步今日提醒', 'syncTaskTimingNoticesToSupabase')
        .addItem('同步員工資料到 Supabase', 'syncTaskTimingEmployeesToSupabase')
        .addItem('設定並開始 Supabase 自動同步', 'setupTaskTimingRecordSync')
        .addItem('立即完整同步生產紀錄', 'syncAndReconcileTaskTimingRecordsToSupabase')
        .addToUi();
}

function taskTimingRecordSheet_() {
    var ss = SpreadsheetApp.openById(RECORDS_SS_ID);
    return ss.getSheetByName('紀錄') || ss.getSheets()[0];
}

function taskTimingEnsureSyncColumns_(sheet) {
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var idCol = headers.indexOf(TASK_TIMING_RECORD_ID_HEADER) + 1;
    var statusCol = headers.indexOf(TASK_TIMING_SYNC_STATUS_HEADER) + 1;

    if (!idCol) {
        idCol = ++lastCol;
        sheet.getRange(1, idCol).setValue(TASK_TIMING_RECORD_ID_HEADER);
    }
    if (!statusCol) {
        statusCol = ++lastCol;
        sheet.getRange(1, statusCol).setValue(TASK_TIMING_SYNC_STATUS_HEADER);
    }
    return { id: idCol, status: statusCol };
}

function taskTimingNumber_(value) {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    var parsed = parseFloat(String(value == null ? '' : value).replace(/,/g, ''));
    return isFinite(parsed) ? parsed : 0;
}

function taskTimingInteger_(value) {
    return Math.round(taskTimingNumber_(value));
}

function taskTimingRatio_(value) {
    if (value == null || value === '') return 0;
    var text = String(value).trim();
    var ratio = taskTimingNumber_(text.replace('%', ''));
    if (text.indexOf('%') !== -1 || Math.abs(ratio) > 10) ratio = ratio / 100;
    return ratio;
}

function taskTimingIsoDate_(value) {
    if (value instanceof Date) return Utilities.formatDate(value, 'GMT+8', 'yyyy-MM-dd');
    var match = String(value == null ? '' : value).trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (!match) return null;
    return match[1] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[3]).padStart(2, '0');
}

function taskTimingTimeText_(value) {
    if (value instanceof Date) return Utilities.formatDate(value, 'GMT+8', 'HH:mm:ss');
    if (typeof value === 'number' && value >= 0 && value < 1) {
        var seconds = Math.round(value * 86400) % 86400;
        return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
            .map(function (part) { return String(part).padStart(2, '0'); })
            .join(':');
    }
    return String(value == null ? '' : value).trim();
}

function taskTimingDurationSeconds_(value) {
    if (typeof value === 'number') return value >= 0 && value < 1 ? Math.round(value * 86400) : value;
    var parts = String(value == null ? '' : value).trim().split(':').map(Number);
    if (parts.length === 3 && parts.every(isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2 && parts.every(isFinite)) return parts[0] * 60 + parts[1];
    return 0;
}

function taskTimingOperator_(label) {
    var text = String(label == null ? '' : label).trim();
    var match = text.match(/^\[([^\]]+)\]\s*(.*)$/);
    return {
        label: text,
        id: match ? match[1] : text,
        name: match ? match[2] : text
    };
}

function taskTimingRecordFromRow_(sheet, rowNumber, row, recordId) {
    var operator = taskTimingOperator_(row[0]);
    return {
        record_id: recordId,
        source_sheet_id: RECORDS_SS_ID,
        source_sheet_name: sheet.getName(),
        source_row: rowNumber,
        operator_label: operator.label,
        operator_id: operator.id,
        operator_name: operator.name,
        car_model: String(row[1] == null ? '' : row[1]),
        category: String(row[2] == null ? '' : row[2]),
        part_number: String(row[3] == null ? '' : row[3]),
        product_name: String(row[4] == null ? '' : row[4]),
        work_date: taskTimingIsoDate_(row[5]),
        start_time: taskTimingTimeText_(row[6]),
        end_time: taskTimingTimeText_(row[7]),
        total_time: taskTimingTimeText_(row[8]),
        total_seconds: taskTimingDurationSeconds_(row[8]),
        avg_time_seconds: taskTimingNumber_(row[9]),
        standard_time_seconds: taskTimingNumber_(row[10]),
        good_count: taskTimingInteger_(row[11]),
        defect_missing: taskTimingInteger_(row[12]),
        defect_deform: taskTimingInteger_(row[13]),
        defect_appearance: taskTimingInteger_(row[14]),
        defect_other: taskTimingInteger_(row[15]),
        total_scrap: taskTimingInteger_(row[16]),
        remarks: String(row[17] == null ? '' : row[17]),
        scrap_rate: taskTimingRatio_(row[18]),
        yield_rate: taskTimingRatio_(row[19]),
        efficiency_ratio: taskTimingRatio_(row[20]),
        satisfaction: taskTimingNumber_(row[21]),
        source_updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
    };
}

function taskTimingSupabaseConfig_() {
    var properties = PropertiesService.getScriptProperties();
    var baseUrl = String(properties.getProperty('TASK_TIMING_SUPABASE_URL') || '').replace(/\/$/, '');
    var secret = properties.getProperty('TASK_TIMING_SUPABASE_SECRET_KEY');
    if (!baseUrl || !secret) throw new Error('尚未設定 TASK_TIMING_SUPABASE_URL 或 TASK_TIMING_SUPABASE_SECRET_KEY');
    return { baseUrl: baseUrl, secret: secret };
}

function taskTimingUpsertRecords_(records) {
    if (!records.length) return;
    var config = taskTimingSupabaseConfig_();
    var response = UrlFetchApp.fetch(
        config.baseUrl + '/rest/v1/task_timing_records?on_conflict=record_id',
        {
            method: 'post',
            contentType: 'application/json',
            headers: {
                ApiKey: config.secret,
                Authorization: 'Bearer ' + config.secret,
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            payload: JSON.stringify(records),
            muteHttpExceptions: true
        }
    );
    var status = response.getResponseCode();
    if (status < 200 || status >= 300) {
        throw new Error('Supabase ' + status + ': ' + response.getContentText().slice(0, 300));
    }
}

function taskTimingReadSupabaseRecordIds_() {
    var config = taskTimingSupabaseConfig_();
    var recordIds = [];
    var start = 0;
    var pageSize = 1000;
    while (true) {
        var response = UrlFetchApp.fetch(
            config.baseUrl + '/rest/v1/task_timing_records?source_sheet_id=eq.' + encodeURIComponent(RECORDS_SS_ID)
                + '&select=record_id&order=record_id.asc',
            {
                method: 'get',
                headers: {
                    ApiKey: config.secret,
                    Authorization: 'Bearer ' + config.secret,
                    Range: start + '-' + (start + pageSize - 1)
                },
                muteHttpExceptions: true
            }
        );
        var status = response.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new Error('讀取 Supabase 生產紀錄失敗 ' + status + ': ' + response.getContentText().slice(0, 300));
        }
        var rows = JSON.parse(response.getContentText() || '[]');
        if (!Array.isArray(rows)) throw new Error('讀取 Supabase 生產紀錄失敗：回應不是陣列');
        rows.forEach(function (row) {
            if (row.record_id) recordIds.push(String(row.record_id));
        });
        if (rows.length < pageSize) break;
        start += pageSize;
    }
    return recordIds;
}

function taskTimingObsoleteRecordIds_(supabaseRecordIds, sheetRecordIds) {
    var sheetIdSet = {};
    sheetRecordIds.forEach(function (recordId) {
        var normalized = String(recordId || '').trim();
        if (normalized) sheetIdSet[normalized] = true;
    });
    return supabaseRecordIds.map(function (recordId) {
        return String(recordId || '').trim();
    }).filter(function (recordId) {
        return recordId && !sheetIdSet[recordId];
    });
}

function taskTimingDeleteRecordIds_(recordIds) {
    if (!recordIds.length) return;
    var config = taskTimingSupabaseConfig_();
    for (var start = 0; start < recordIds.length; start += TASK_TIMING_DELETE_BATCH_SIZE) {
        var batch = recordIds.slice(start, start + TASK_TIMING_DELETE_BATCH_SIZE);
        var response = UrlFetchApp.fetch(
            config.baseUrl + '/rest/v1/task_timing_records?source_sheet_id=eq.' + encodeURIComponent(RECORDS_SS_ID)
                + '&record_id=in.(' + batch.map(encodeURIComponent).join(',') + ')',
            {
                method: 'delete',
                headers: {
                    ApiKey: config.secret,
                    Authorization: 'Bearer ' + config.secret
                },
                muteHttpExceptions: true
            }
        );
        var status = response.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new Error('刪除 Supabase 生產紀錄失敗 ' + status + ': ' + response.getContentText().slice(0, 300));
        }
    }
}

function taskTimingClearContinuation_() {
    var handler = 'continueTaskTimingRecordSync';
    // A one-shot trigger is still visible to getProjectTriggers() while its
    // handler is running (and may remain listed as disabled afterward). Remove
    // that stale trigger before scheduling the next batch so backfills do not
    // stop after 2,000 rows.
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
        if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
    });
}

function taskTimingScheduleContinuation_() {
    taskTimingClearContinuation_();
    ScriptApp.newTrigger('continueTaskTimingRecordSync').timeBased().after(60 * 1000).create();
}

function continueTaskTimingRecordSync() {
    return syncTaskTimingRecordsToSupabase();
}

function setupTaskTimingRecordSync() {
    taskTimingSupabaseConfig_();
    var handler = 'syncTaskTimingRecordsToSupabase';
    var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
        return trigger.getHandlerFunction() === handler;
    });
    if (!exists) ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();

    taskTimingEnsureSheetChangeTrigger_('taskTimingHandleRecordSheetChange', RECORDS_SS_ID);
    taskTimingEnsureSheetChangeTrigger_('taskTimingHandleEmployeeSheetChange', PRODUCTS_SS_ID);
    return syncTaskTimingRecordsToSupabase();
}

function taskTimingEnsureSheetChangeTrigger_(handler, spreadsheetId) {
    var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
        return trigger.getHandlerFunction() === handler;
    });
    if (!exists) {
        ScriptApp.newTrigger(handler)
            .forSpreadsheet(spreadsheetId)
            .onChange()
            .create();
    }
}

function syncTaskTimingRecordsToSupabase() {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
        taskTimingClearContinuation_();
        var sheet = taskTimingRecordSheet_();
        var columns = taskTimingEnsureSyncColumns_(sheet);
        var lastRow = sheet.getLastRow();
        if (lastRow <= 1) return { synced: 0, failed: 0, remaining: 0 };

        var width = Math.max(sheet.getLastColumn(), columns.id, columns.status, 22);
        var rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();
        var pending = [];
        for (var index = 0; index < rows.length; index++) {
            if (!rows[index][columns.id - 1]) {
                rows[index][columns.id - 1] = Utilities.getUuid();
                rows[index][columns.status - 1] = '待同步';
            }
            if (String(rows[index][columns.status - 1] || '') === '已同步') continue;
            pending.push({
                index: index,
                record: taskTimingRecordFromRow_(sheet, index + 2, rows[index], String(rows[index][columns.id - 1]))
            });
            if (pending.length >= TASK_TIMING_RECORD_BATCH_SIZE) break;
        }

        var synced = 0;
        var failed = 0;
        for (var start = 0; start < pending.length; start += TASK_TIMING_UPSERT_BATCH_SIZE) {
            var chunk = pending.slice(start, start + TASK_TIMING_UPSERT_BATCH_SIZE);
            try {
                taskTimingUpsertRecords_(chunk.map(function (item) { return item.record; }));
                chunk.forEach(function (item) {
                    rows[item.index][columns.status - 1] = '已同步';
                    synced++;
                });
            } catch (error) {
                chunk.forEach(function (item) {
                    rows[item.index][columns.status - 1] = '待重試';
                    failed++;
                });
                console.error(error);
                // Leave failed rows for the regular ten-minute retry. A failed
                // batch must not create an endless one-minute continuation loop.
                break;
            }
        }

        sheet.getRange(2, columns.id, rows.length, 1)
            .setValues(rows.map(function (row) { return [row[columns.id - 1] || '']; }));
        sheet.getRange(2, columns.status, rows.length, 1)
            .setValues(rows.map(function (row) { return [row[columns.status - 1] || '']; }));

        var remaining = Math.max(0, rows.filter(function (row) {
            return String(row[columns.status - 1] || '') !== '已同步';
        }).length);
        if (remaining > 0 && failed === 0) taskTimingScheduleContinuation_();
        return { synced: synced, failed: failed, remaining: remaining };
    } finally {
        lock.releaseLock();
    }
}

function taskTimingSyncAndReconcileRecords_(options) {
    var automatic = options && options.automatic === true;
    var ui = automatic ? null : SpreadsheetApp.getUi();
    try {
        var syncResult = syncTaskTimingRecordsToSupabase();
        if (syncResult.failed > 0 || syncResult.remaining > 0) {
            var incompleteMessage = '生產紀錄尚未全部同步：成功 ' + syncResult.synced + ' 筆、失敗 '
                + syncResult.failed + ' 筆、待處理 ' + syncResult.remaining + ' 筆。本次未執行刪除。';
            if (ui) ui.alert(incompleteMessage);
            else console.error(incompleteMessage);
            return {
                synced: syncResult.synced,
                failed: syncResult.failed,
                remaining: syncResult.remaining,
                deleted: 0
            };
        }

        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
            var sheet = taskTimingRecordSheet_();
            var columns = taskTimingEnsureSyncColumns_(sheet);
            var lastRow = sheet.getLastRow();
            var sheetRecordIds = lastRow <= 1 ? [] : sheet.getRange(2, columns.id, lastRow - 1, 1)
                .getDisplayValues()
                .map(function (row) { return String(row[0] || '').trim(); })
                .filter(function (recordId) { return Boolean(recordId); });
            var supabaseRecordIds = taskTimingReadSupabaseRecordIds_();
            var obsoleteRecordIds = taskTimingObsoleteRecordIds_(supabaseRecordIds, sheetRecordIds);
            if (!automatic && obsoleteRecordIds.length > 0) {
                var confirmation = ui.alert(
                    '確認刪除 Supabase 生產紀錄',
                    'Sheet 已不存在的 ' + obsoleteRecordIds.length + ' 筆紀錄將從 Supabase 永久刪除。是否繼續？',
                    ui.ButtonSet.YES_NO
                );
                if (confirmation !== ui.Button.YES) {
                    ui.alert('已取消刪除，Supabase 生產紀錄沒有變更。');
                    return {
                        synced: syncResult.synced,
                        failed: 0,
                        remaining: 0,
                        deleted: 0,
                        cancelled: true
                    };
                }
            }
            taskTimingDeleteRecordIds_(obsoleteRecordIds);
            var result = {
                synced: syncResult.synced,
                failed: 0,
                remaining: 0,
                deleted: obsoleteRecordIds.length
            };
            if (ui) {
                ui.alert('完整同步完成：新增或更新 ' + result.synced + ' 筆、刪除 ' + result.deleted + ' 筆。');
            } else {
                console.log('刪除列自動同步完成：新增或更新 ' + result.synced + ' 筆、刪除 ' + result.deleted + ' 筆。');
            }
            return result;
        } finally {
            lock.releaseLock();
        }
    } catch (error) {
        var errorMessage = '完整同步失敗：' + String(error && error.message ? error.message : error);
        if (ui) ui.alert(errorMessage);
        else console.error(errorMessage);
        throw error;
    }
}

function syncAndReconcileTaskTimingRecordsToSupabase() {
    return taskTimingSyncAndReconcileRecords_({ automatic: false });
}

function taskTimingHandleRecordSheetChange(e) {
    if (!e || e.changeType !== 'REMOVE_ROW') return;
    return taskTimingSyncAndReconcileRecords_({ automatic: true });
}

function doGet(e) {
    // 紀錄表不快取：作業員上傳後會馬上去看戰報，拿到 10 分鐘前的舊資料等於錯的。
    // 產品表與員工資料一天內幾乎不變，才是快取的對象。
    var cacheable = (e.parameter.action !== 'records') && !e.parameter.nocache;

    // 用完整的查詢參數當快取鍵，不同的篩選條件各自快取
    var cacheKey = 'v1_' + JSON.stringify(e.parameter);
    var cache = CacheService.getScriptCache();

    if (cacheable) {
        try {
            var hit = cache.get(cacheKey);
            if (hit) {
                return ContentService.createTextOutput(hit)
                    .setMimeType(ContentService.MimeType.JSON);
            }
        } catch (err) {
            // 快取讀取失敗就當作沒命中，繼續往下走
        }
    }

    var payload = buildPayload(e);

    // CacheService 單筆上限 100KB，超過就不快取（直接回傳仍然正常）
    try {
        if (cacheable && payload.length < 100000) {
            cache.put(cacheKey, payload, CACHE_TTL_SECONDS);
        }
    } catch (err) {
        // 快取寫入失敗不影響回應
    }

    return ContentService.createTextOutput(payload)
        .setMimeType(ContentService.MimeType.JSON);
}

function buildPayload(e) {
    // action=records → 讀紀錄表；其他 → 讀產品資料表
    var ssId = (e.parameter.action === 'records') ? RECORDS_SS_ID : PRODUCTS_SS_ID;

    var sheetName = e.parameter.sheet;
    var sheetIndex = e.parameter.index;
    var includeCol = e.parameter.includeCol;
    var filterVal = e.parameter.filterVal;
    var excludeVal = e.parameter.excludeVal;
    var prune = e.parameter.prune;

    var ss = SpreadsheetApp.openById(ssId);

    var sheet;
    if (sheetName) {
        sheet = ss.getSheetByName(sheetName);
    } else if (sheetIndex !== undefined) {
        sheet = ss.getSheets()[parseInt(sheetIndex)];
    } else {
        sheet = ss.getSheets()[0];
    }

    // 紀錄表裡並沒有叫「紀錄」的分頁（實際是第一個分頁），
    // 所以找不到指定名稱時退回第一個分頁 —— doPost 本來就是這樣做的。
    // 少了這段，前端算漏傳天數與戰報都會拿到「找不到工作表」。
    if (!sheet && e.parameter.action === 'records') {
        sheet = ss.getSheets()[0];
    }

    if (!sheet) {
        return JSON.stringify({ "result": "error", "message": "找不到工作表" });
    }

    // ?lastRows=N → 只讀最後 N 筆（加上標題列）。
    // 紀錄表已經大到整張讀取會超時（實測 40 秒後回 404），
    // 而戰報與漏傳天數都只需要最近的資料。紀錄是用 appendRow 依時間往下加，
    // 所以「最後 N 筆」就是「最近 N 筆」。
    var lastRowsParam = parseInt(e.parameter.lastRows, 10);
    var data;
    var lastRow = sheet.getLastRow();
    if (lastRowsParam > 0 && lastRow > 1) {
        var lastCol = sheet.getLastColumn();
        var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        var takeRows = Math.min(lastRow - 1, lastRowsParam);
        var body = sheet.getRange(lastRow - takeRows + 1, 1, takeRows, lastCol).getValues();
        data = [headerRow].concat(body);
    } else {
        data = sheet.getDataRange().getValues();
    }
    var headers = data[0];
    var jsonArray = [];

    // 1. 找出篩選欄位的索引 (不分括號)
    var filterIdx = -1;
    if (includeCol) {
        for (var h = 0; h < headers.length; h++) {
            var cleanH = headers[h].replace(/\[.*?\]/g, "").trim();
            if (cleanH.indexOf(includeCol) !== -1 || headers[h].indexOf(includeCol) !== -1) {
                filterIdx = h;
                break;
            }
        }
    }

    for (var i = 1; i < data.length; i++) {
        // 2. 篩選
        if (filterIdx !== -1) {
            var cellValue = String(data[i][filterIdx]);
            // 包含邏輯
            if (filterVal && cellValue.indexOf(filterVal) === -1) continue;
            // 排除邏輯
            if (excludeVal && cellValue.indexOf(excludeVal) !== -1) continue;
            // 如果欄位完全是空的 (非作業性內容)，也排除 (可選)
            if (!cellValue.trim()) continue;
        }

        var obj = {};
        var hasKeyData = false;
        for (var j = 0; j < headers.length; j++) {
            var originalHeader = headers[j];

            // 3. 欄位裁剪 (Pruning)
            var isMatch = false;
            if (prune) {
                var patterns = prune.split('|');
                for (var p = 0; p < patterns.length; p++) {
                    if (originalHeader.indexOf(patterns[p]) !== -1) {
                        isMatch = true;
                        break;
                    }
                }
            } else {
                isMatch = true;
            }

            if (!isMatch) continue;

            // 4. 清理標題 (自動移除 [] 中括號內容) ── 這是修復關鍵：確保 key 是 "品番" 而不是 "[] 品番"
            var cleanHeader = originalHeader.replace(/\[.*?\]/g, "").trim();
            obj[cleanHeader] = data[i][j];
            hasKeyData = true;
        }

        // 5. 檢查關鍵欄位是否存在
        if (hasKeyData && obj['品番'] && obj['車型']) {
            jsonArray.push(obj);
        } else if (hasKeyData && !prune) {
            jsonArray.push(obj);
        }
    }

    // 調試模式：如果沒找到任何產品，回傳前 15 個欄位名稱供研究
    if (jsonArray.length === 0 && prune) {
        return JSON.stringify({
            "result": "debug",
            "message": "找不到符合條件的產品",
            "detected_headers": headers.slice(0, 15),
            "clean_headers": headers.slice(0, 15).map(function (h) { return h.replace(/\[.*?\]/g, "").trim(); })
        });
    }

    return JSON.stringify(jsonArray);
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        var data = JSON.parse(e.postData.contents);
        var recordId = String(data.recordId || Utilities.getUuid());
        var rowData = [
            data.operator || "", 
            data.carModel || "", 
            data.category || "",      // 新增類別欄位
            data.partNumber || "", 
            data.productName || "",
            data.date || "", 
            data.startTime || "", 
            data.endTime || "", 
            data.totalTime || "",
            data.avgTime || "", 
            data.standardTime || 0, 
            data.goodCount || 0, 
            data.missing || 0,
            data.deform || 0,
            data.appearance || 0, 
            data.others || 0, 
            data.totalScrap || 0,
            data.remarks || "", 
            data.scrapRate || "", 
            data.yieldRate || "", 
            data.efficiency || "",
            data.satisfaction || 0    // 滿意度
        ];
        var sheet = taskTimingRecordSheet_();
        var columns = taskTimingEnsureSyncColumns_(sheet);
        sheet.appendRow(rowData);
        var rowNumber = sheet.getLastRow();
        sheet.getRange(rowNumber, columns.id).setValue(recordId);
        sheet.getRange(rowNumber, columns.status).setValue('待同步');
        SpreadsheetApp.flush();

        var synced = false;
        try {
            var storedRow = sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), 22)).getValues()[0];
            taskTimingUpsertRecords_([taskTimingRecordFromRow_(sheet, rowNumber, storedRow, recordId)]);
            sheet.getRange(rowNumber, columns.status).setValue('已同步');
            synced = true;
        } catch (syncError) {
            sheet.getRange(rowNumber, columns.status).setValue('待重試');
            console.error(syncError);
            // The regular sync retries this row; do not accelerate failures.
        }

        return ContentService.createTextOutput(JSON.stringify({
            "result": "success",
            "row": rowNumber,
            "recordId": recordId,
            "supabaseSynced": synced
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": String(error.message || error) })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// 固定 CSV 欄位名稱，對應 doPost 寫入順序，不隨資料內容變動
const CSV_HEADERS = [
  '作業員', '車型', '類別', '品番', '品名',
  '日期', '開始時間', '結束時間', '總時間', '平均時間',
  '標準工時', '良品數', '缺料數', '變形數', '外觀異常數',
  '其他報廢數', '總報廢數', '備註', '報廢率', '良率', '效率', '滿意度'
];

function sendAdvancedSummaryEmail() {
  const recordSS = SpreadsheetApp.openById(RECORDS_SS_ID);
  const recordSheet = recordSS.getSheets()[0];
  const recordData = recordSheet.getDataRange().getValues();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1);
  const targetDateSlash = Utilities.formatDate(targetDate, "GMT+8", "yyyy/MM/dd");
  const targetDateDash  = Utilities.formatDate(targetDate, "GMT+8", "yyyy-MM-dd");

  const formatCsvValue = (v) => {
    if (v instanceof Date) {
      const hasTime = v.getHours() !== 0 || v.getMinutes() !== 0 || v.getSeconds() !== 0;
      v = hasTime
        ? Utilities.formatDate(v, 'GMT+8', 'HH:mm:ss')
        : Utilities.formatDate(v, 'GMT+8', 'yyyy/MM/dd');
    }
    const s = v == null ? '' : String(v);
    return /["\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const yesterdayRecords = recordData.slice(1).filter(row => {
    const rowDate = row[5] instanceof Date
      ? Utilities.formatDate(row[5], "GMT+8", "yyyy/MM/dd")
      : row[5];
    return rowDate === targetDateSlash;
  });

  const csvLines = [CSV_HEADERS.map(formatCsvValue).join(',')];
  yesterdayRecords.forEach(row => {
    csvLines.push(row.slice(0, CSV_HEADERS.length).map(formatCsvValue).join(','));
  });
  // 加上 UTF-8 BOM，避免用 Excel 開啟時中文亂碼
  const csvContent = '﻿' + csvLines.join('\r\n');

  const fileName = `assembly_report_${targetDateDash}.csv`;
  const csvBlob = Utilities.newBlob(csvContent, 'text/csv;charset=UTF-8', fileName);

  const body = [
    `REPORT_DATE=${targetDateSlash}`,
    `ROW_COUNT=${yesterdayRecords.length}`,
    `CSV_ATTACHED=YES`
  ].join('\n');

  GmailApp.sendEmail(
    "allcrazy.it@gmail.com",
    `【組裝日報CSV】${targetDateSlash}`,
    body,
    { attachments: [csvBlob] }
  );
}

// 輔助函式 (修正 Google Sheet 時間格式解析，解決 NaN 問題)
function formatSeconds(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? `${h}小時 ${m}分` : `${m}分鐘`;
}
function getTimeGapInMinutes(e, s) {
  if(!e || !s) return 0; 
  if(e instanceof Date && s instanceof Date) return (s.getTime() - e.getTime()) / 60000;
  const p = (t) => { 
    if(t instanceof Date) return t.getHours()*60 + t.getMinutes();
    if(typeof t === 'number') return Math.round(t * 24 * 60);
    const x = String(t).split(':').map(Number); 
    return x[0]*60 + x[1]; 
  }; 
  return p(s)-p(e); 
}


// 今日提醒 uses a full snapshot so edits, disabling, and deleted rows converge together.
function setupTaskTimingNoticeSync() {
    taskTimingSupabaseConfig_();
    var ss = SpreadsheetApp.openById(RECORDS_SS_ID);
    var sheet = ss.getSheetByName('今日提醒');
    if (!sheet) {
        sheet = ss.insertSheet('今日提醒');
        sheet.getRange(1, 1, 1, 4).setValues([['開始日期', '結束日期', '提醒內容', '啟用']]);
        sheet.setFrozenRows(1);
        sheet.getRange(2, 1, sheet.getMaxRows() - 1, 2).setNumberFormat('yyyy/mm/dd');
        sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).insertCheckboxes();
        sheet.setColumnWidth(3, 420);
        sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setWrap(true);
    }
    var noticeHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 4)).getDisplayValues()[0];
    ['越南文', '印尼文'].forEach(function (header) {
        if (noticeHeaders.indexOf(header) === -1) {
            var column = noticeHeaders.length + 1;
            sheet.getRange(1, column).setValue(header);
            sheet.setColumnWidth(column, 420);
            noticeHeaders.push(header);
        }
    });
    var handler = 'syncTaskTimingNoticesToSupabase';
    if (!ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === handler; })) {
        ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();
    }
    if (!ScriptApp.getProjectTriggers().some(function (trigger) { return trigger.getHandlerFunction() === 'taskTimingHandleNoticeEdit'; })) {
        ScriptApp.newTrigger('taskTimingHandleNoticeEdit').forSpreadsheet(RECORDS_SS_ID).onEdit().create();
    }
    return syncTaskTimingNoticesToSupabase();
}

function taskTimingHandleNoticeEdit(e) {
    if (e && e.range && e.range.getSheet().getName() === '今日提醒') return syncTaskTimingNoticesToSupabase();
}

function taskTimingNoticeRows_(rows, headers) {
    headers = headers || ['開始日期', '結束日期', '提醒內容', '啟用', '越南文', '印尼文'];
    function field(row, name) { return row[headers.indexOf(name)]; }
    return rows.reduce(function (notices, row, index) {
        var content = String(field(row, '提醒內容') == null ? '' : field(row, '提醒內容')).trim();
        var enabled = field(row, '啟用') === true || /^(true|1|是)$/i.test(String(field(row, '啟用')).trim());
        if (!enabled) return notices;
        var start = taskTimingIsoDate_(field(row, '開始日期'));
        var endValue = field(row, '結束日期');
        var hasEnd = endValue != null && String(endValue).trim() !== '';
        var end = hasEnd ? taskTimingIsoDate_(endValue) : null;
        function validDate(value) {
            if (!value) return false;
            var date = new Date(value + 'T00:00:00Z');
            return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
        }
        if (!content || !validDate(start) || (hasEnd && (!validDate(end) || start > end))) {
            throw new Error('今日提醒第 ' + (index + 2) + ' 列：請填寫有效的開始日期、提醒內容；結束日期可留空，填寫時不可早於開始日期。');
        }
        notices.push({ start_date: start, end_date: end, content: content, content_vi: String(field(row, '越南文') || '').trim(), content_id: String(field(row, '印尼文') || '').trim() });
        return notices;
    }, []);
}

function syncTaskTimingNoticesToSupabase() {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('其他同步正在執行，今日提醒將於下次重試。');
    try {
        var sheet = SpreadsheetApp.openById(RECORDS_SS_ID).getSheetByName('今日提醒');
        if (!sheet) throw new Error('找不到今日提醒分頁；未覆蓋現有提醒。');
        var columnCount = Math.max(sheet.getLastColumn(), 4);
        var headers = sheet.getRange(1, 1, 1, columnCount).getDisplayValues()[0];
        if (['開始日期', '結束日期', '提醒內容', '啟用'].some(function (header) { return headers.indexOf(header) === -1 || headers.indexOf(header) !== headers.lastIndexOf(header); })) throw new Error('今日提醒欄位順序不正確；未覆蓋現有提醒。');
        var notices = taskTimingNoticeRows_(sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues() : [], headers);
        var config = taskTimingSupabaseConfig_();
        var response = UrlFetchApp.fetch(config.baseUrl + '/rest/v1/task_timing_notice_snapshot?on_conflict=source_sheet_id', {
            method: 'post', contentType: 'application/json',
            headers: { ApiKey: config.secret, Authorization: 'Bearer ' + config.secret, Prefer: 'resolution=merge-duplicates,return=minimal' },
            payload: JSON.stringify([{ source_sheet_id: RECORDS_SS_ID, notices: notices, synced_at: new Date().toISOString() }]),
            muteHttpExceptions: true
        });
        if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('今日提醒同步失敗：' + response.getResponseCode());
        return { synced: notices.length };
    } finally { lock.releaseLock(); }
}
