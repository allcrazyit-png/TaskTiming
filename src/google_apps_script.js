const PRODUCTS_SS_ID = '1YSOI1VPh4GBYkr7QVx60YOxtrfpC4JofuXOy_dyPHaQ'; // 產品資料表 (讀)
const RECORDS_SS_ID = '1xo4YhDuxh-wpstg7tmAqW4orB9aBheF1CUFzM1TDWKw';  // 組裝紀錄表 (寫)

function doGet(e) {
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

    if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "找不到工作表" })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
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
        return ContentService.createTextOutput(JSON.stringify({
            "result": "debug",
            "message": "找不到符合條件的產品",
            "detected_headers": headers.slice(0, 15),
            "clean_headers": headers.slice(0, 15).map(function (h) { return h.replace(/\[.*?\]/g, "").trim(); })
        })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify(jsonArray))
        .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(10000);
        var data = JSON.parse(e.postData.contents);
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
            data.damage || 0, 
            data.appearance || 0, 
            data.others || 0, 
            data.totalScrap || 0,
            data.remarks || "", 
            data.scrapRate || "", 
            data.yieldRate || "", 
            data.efficiency || "",
            data.satisfaction || 0    // 滿意度
        ];
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet = ss.getSheetByName("紀錄") || ss.getSheets()[0];
        sheet.appendRow(rowData);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ "result": "success", "row": sheet.getLastRow() })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "找不到工作表" })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// ─── 系統帳號白名單：永遠排除在 MISSING_UPLOADS 之外 ───────────────────────
// 格式與員工資料表的「[編號] 姓名」一致；新增系統帳號時在此加入即可
const SYSTEM_ACCOUNTS = ['[0] admin'];

function sendAdvancedSummaryEmail() {
  const recordSS = SpreadsheetApp.openById(RECORDS_SS_ID);
  const employeeSS = SpreadsheetApp.openById(PRODUCTS_SS_ID);

  const recordSheet = recordSS.getSheets()[0];
  const employeeSheet = employeeSS.getSheetByName("員工資料") || employeeSS.getSheets()[0];

  const recordData = recordSheet.getDataRange().getValues();
  const employeeData = employeeSheet.getDataRange().getValues();

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1);
  const targetDateSlash = Utilities.formatDate(targetDate, "GMT+8", "yyyy/MM/dd");
  const targetDateDash  = Utilities.formatDate(targetDate, "GMT+8", "yyyy-MM-dd");

  // 欄位索引（對應 doPost 寫入順序，不依賴表頭名稱）
  const idx = {
    op: 0, car: 1, prod: 4,
    date: 5, start: 6, end: 7, tt: 8,
    mis: 12, dmg: 13, app: 14, oth: 15,
    eff: 20
  };

  const DEFECT_TYPES = [
    { key: 'mis', label: '缺料' },
    { key: 'dmg', label: '損傷' },
    { key: 'app', label: '外觀' },
    { key: 'oth', label: '其他' }
  ];

  const WORK_START  = 8  * 60;
  const WORK_END    = 17 * 60;
  const LUNCH_START = 12 * 60;
  const LUNCH_END   = 13 * 60;
  // 異常偵測門檻（調整這兩個值即可，不需要動下面的邏輯）
  const ANOMALY_TIME_DIFF = 30 * 60; // (end-start) 與 totalTime 差距超過 30 分鐘視為異常
  const ANOMALY_MAX_MIN   = 4  * 60; // 單筆工單超過 4 小時視為過長

  const parseE = (s) => typeof s === 'number' ? s * 100 : parseFloat(String(s).replace('%', '')) || 0;
  const toMin  = (t) => {
    if (!t) return 0;
    if (t instanceof Date) return t.getHours() * 60 + t.getMinutes();
    if (typeof t === 'number') return Math.round(t * 24 * 60);
    const x = String(t).split(':').map(Number);
    return x[0] * 60 + (x[1] || 0);
  };
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const calcEffectiveGap = (start, end) => {
    const cs = Math.max(start, WORK_START);
    const ce = Math.min(end, WORK_END);
    if (ce <= cs) return { gap: 0, cs, ce };
    const lunch = Math.max(0, Math.min(ce, LUNCH_END) - Math.max(cs, LUNCH_START));
    return { gap: (ce - cs) - lunch, cs, ce };
  };

  const yesterdayRecords = recordData.slice(1).filter(row => {
    const rowDate = row[idx.date] instanceof Date
      ? Utilities.formatDate(row[idx.date], "GMT+8", "yyyy/MM/dd")
      : row[idx.date];
    return rowDate === targetDateSlash;
  });

  // 無紀錄時仍輸出固定格式
  const EMPTY_BODY = [
    `【昨日數據日報測試】`,
    `REPORT_DATE: ${targetDateDash}`,
    ``,
    `[效率排名]`,
    `TOP_PRODUCT: 無`,
    `BOTTOM_PRODUCT: 無`,
    ``,
    `[品質：成型不良統計]`,
    `DEFECTS: 無`,
    `DEFECT_SUMMARY: 今日無成型不良紀錄 👍`,
    ``,
    `[員工個人平均效率]`,
    `WORKER_AVG: 無`,
    ``,
    `[異常監控]`,
    `MISSING_UPLOADS: 無`,
    `LONG_GAPS: 無`,
    `UNSPECIFIED_TOTAL: 0 分鐘`,
    `UNSPECIFIED_ITEMS: 無`,
    `ANOMALIES: 無`,
    `ANOMALY_SUMMARY: 共 0 筆異常時間紀錄`
  ].join('\n');

  if (yesterdayRecords.length === 0) {
    GmailApp.sendEmail(
      "allcrazy.it@gmail.com",
      `【昨日數據日報測試】${targetDateSlash} 成型品質與效率分析`,
      EMPTY_BODY
    );
    return;
  }

  // 雙穴分拆紀錄識別（品名以 (R邊)/(L邊) 結尾）
  const isDualHole = (p) => /\([RL]邊\)$/.test(String(p));
  const baseName   = (p) => String(p).replace(/\s*\([RL]邊\)$/, '').trim();

  // --- 統計 ---
  let statsByOperator = {}, prodEff = {}, defects = {};
  let unspecWork = { totalSec: 0, items: [] };
  let anomalies = [];

  yesterdayRecords.forEach(r => {
    const op = r[idx.op];
    if (!op) return;
    const prod = r[idx.prod];
    const car  = r[idx.car];
    const eff  = parseE(r[idx.eff]);
    const isUnspecified = String(prod).includes("未指定") || String(car).includes("未指定");

    if (!statsByOperator[op]) statsByOperator[op] = { effs: [], recs: [] };

    if (!isUnspecified) {
      statsByOperator[op].effs.push(eff);
      if (!prodEff[prod]) prodEff[prod] = [];
      prodEff[prod].push(eff);
    }

    statsByOperator[op].recs.push({ s: r[idx.start], e: r[idx.end], prod });

    // 不良統計（缺料/損傷/外觀/其他）
    DEFECT_TYPES.forEach(dt => {
      const cnt = Number(r[idx[dt.key]]) || 0;
      if (cnt > 0) {
        const key = `${prod}|${dt.label}`;
        defects[key] = (defects[key] || 0) + cnt;
      }
    });

    // 未指定工單
    if (isUnspecified) {
      const sec = timeStringToSeconds(r[idx.tt]);
      unspecWork.totalSec += sec;
      unspecWork.items.push(`${op}|${Math.floor(sec / 60)} 分鐘|${prod}`);
    }

    // 異常偵測（每筆工單）
    const startMin = toMin(r[idx.start]);
    const endMin   = toMin(r[idx.end]);
    const ttSec    = timeStringToSeconds(r[idx.tt]);
    const sStr     = formatTimeHM(r[idx.start]);
    const eStr     = formatTimeHM(r[idx.end]);
    const hasTime  = startMin > 0 && endMin > 0;

    if (hasTime && endMin < startMin) {
      // 1. 結束時間早於開始時間
      anomalies.push(`${op}|${prod}|${sStr}-${eStr}|時間倒序`);
    } else if (hasTime) {
      const durSec = (endMin - startMin) * 60;
      // 2. 有起訖時間但 totalTime = 0（雙穴也算異常）
      if (ttSec === 0) {
        anomalies.push(`${op}|${prod}|${sStr}-${eStr}|總時間為零`);
      // 3. (end-start) 與 totalTime 差距超過門檻（雙穴分拆紀錄的比例分攤是預期行為，排除）
      } else if (!isDualHole(prod) && Math.abs(durSec - ttSec) > ANOMALY_TIME_DIFF) {
        anomalies.push(`${op}|${prod}|${sStr}-${eStr}|時間差異過大`);
      }
      // 5. 單筆工單超過門檻時長
      if ((endMin - startMin) > ANOMALY_MAX_MIN) {
        anomalies.push(`${op}|${prod}|${sStr}-${eStr}|單筆過長`);
      }
    }
  });

  // 4. 同一作業員的工單時間重疊
  Object.keys(statsByOperator).forEach(op => {
    const recs = statsByOperator[op].recs.filter(r => {
      const s = toMin(r.s), e = toMin(r.e);
      return s > 0 && e > 0 && e > s;
    });
    for (let i = 0; i < recs.length - 1; i++) {
      for (let j = i + 1; j < recs.length; j++) {
        const s1 = toMin(recs[i].s), e1 = toMin(recs[i].e);
        const s2 = toMin(recs[j].s), e2 = toMin(recs[j].e);
        if (s1 < e2 && s2 < e1) {
          // 雙穴配對（同底名的 R邊↔L邊）重疊是設計行為，排除
          if (isDualHole(recs[i].prod) && isDualHole(recs[j].prod) &&
              baseName(recs[i].prod) === baseName(recs[j].prod)) continue;
          const os = fmt(Math.max(s1, s2));
          const oe = fmt(Math.min(e1, e2));
          anomalies.push(`${op}|${recs[i].prod}↔${recs[j].prod}|${os}-${oe}|工單時間重疊`);
        }
      }
    }
  });

  // 產品效率排名
  const avgEffs = Object.keys(prodEff).map(p => ({
    n: p,
    v: prodEff[p].reduce((a, b) => a + b, 0) / prodEff[p].length
  })).sort((a, b) => b.v - a.v);

  // 空窗偵測
  // 規則：有上傳紀錄的人才進 LONG_GAPS（無紀錄者進 MISSING_UPLOADS，兩者互斥）
  // 標籤：兩筆工單之間的空窗標為「中間斷工」；最後一筆到下班前標為「末段空窗」
  let idles = [];
  Object.keys(statsByOperator).forEach(op => {
    const recs = statsByOperator[op].recs.sort((a, b) => toMin(a.s) - toMin(b.s));

    for (let i = 0; i < recs.length - 1; i++) {
      if (!recs[i].e || !recs[i + 1].s) continue;
      const { gap, cs, ce } = calcEffectiveGap(toMin(recs[i].e), toMin(recs[i + 1].s));
      if (gap > 60) idles.push(`${op}|${fmt(cs)}-${fmt(ce)}|${gap} 分鐘|中間斷工`);
    }

    const last = recs[recs.length - 1];
    if (last && last.e && toMin(last.e) < WORK_END) {
      const { gap, cs, ce } = calcEffectiveGap(toMin(last.e), WORK_END);
      if (gap > 60) idles.push(`${op}|${fmt(cs)}-${fmt(ce)}|${gap} 分鐘|末段空窗`);
    }
  });

  // 未上傳員工（排除系統帳號；有工單紀錄者不重複列入）
  const uploadedOps = new Set(Object.keys(statsByOperator));
  const allEmp  = employeeData.slice(1).map(r => `[${r[0]}] ${r[1]}`);
  const missEmp = allEmp.filter(e =>
    !uploadedOps.has(e) && !SYSTEM_ACCOUNTS.includes(e)
  );

  // --- 組裝固定格式正文 ---
  const L = [];
  const push = (...args) => args.forEach(s => L.push(s));

  push(`【昨日數據日報測試】`, `REPORT_DATE: ${targetDateDash}`, ``);

  // 效率排名
  push(`[效率排名]`);
  push(`TOP_PRODUCT: ${avgEffs.length > 0 ? `${avgEffs[0].n}|${avgEffs[0].v.toFixed(1)}%` : '無'}`);
  push(`BOTTOM_PRODUCT: ${avgEffs.length > 0 ? `${avgEffs[avgEffs.length - 1].n}|${avgEffs[avgEffs.length - 1].v.toFixed(1)}%` : '無'}`);
  push(``);

  // 不良統計
  push(`[品質：成型不良統計]`);
  const defectKeys = Object.keys(defects);
  if (defectKeys.length > 0) {
    push(`DEFECTS:`);
    defectKeys.forEach(k => push(`${k}|${defects[k]} pcs`));
    const total = Object.values(defects).reduce((a, b) => a + b, 0);
    push(`DEFECT_SUMMARY: 成型不良共 ${total} pcs`);
  } else {
    push(`DEFECTS: 無`, `DEFECT_SUMMARY: 今日無成型不良紀錄 👍`);
  }
  push(``);

  // 員工效率
  push(`[員工個人平均效率]`);
  const workerKeys = Object.keys(statsByOperator);
  if (workerKeys.length > 0) {
    push(`WORKER_AVG:`);
    workerKeys.forEach(op => {
      const effs = statsByOperator[op].effs;
      const avg  = effs.length > 0 ? `${(effs.reduce((a, b) => a + b, 0) / effs.length).toFixed(1)}%` : 'N/A';
      push(`${op}|${avg}`);
    });
  } else {
    push(`WORKER_AVG: 無`);
  }
  push(``);

  // 異常監控
  push(`[異常監控]`);
  if (missEmp.length > 0) { push(`MISSING_UPLOADS:`); missEmp.forEach(e => push(e)); }
  else                     { push(`MISSING_UPLOADS: 無`); }
  push(``);

  if (idles.length > 0) { push(`LONG_GAPS:`); idles.forEach(i => push(i)); }
  else                  { push(`LONG_GAPS: 無`); }
  push(``);

  push(`UNSPECIFIED_TOTAL: ${Math.floor(unspecWork.totalSec / 60)} 分鐘`);
  if (unspecWork.items.length > 0) { push(`UNSPECIFIED_ITEMS:`); unspecWork.items.forEach(i => push(i)); }
  else                              { push(`UNSPECIFIED_ITEMS: 無`); }
  push(``);

  if (anomalies.length > 0) { push(`ANOMALIES:`); anomalies.forEach(a => push(a)); }
  else                      { push(`ANOMALIES: 無`); }
  push(`ANOMALY_SUMMARY: 共 ${anomalies.length} 筆異常時間紀錄`);

  GmailApp.sendEmail(
    "allcrazy.it@gmail.com",
    `【昨日數據日報測試】${targetDateSlash} 成型品質與效率分析`,
    L.join('\n')
  );
}

// 輔助函式 (修正 Google Sheet 時間格式解析，解決 NaN 問題)
function timeStringToSeconds(t) { 
  if(!t) return 0; 
  if(t instanceof Date) return t.getHours()*3600 + t.getMinutes()*60 + t.getSeconds();
  if(typeof t === 'number') return Math.round(t * 24 * 3600);
  const p = String(t).split(':').map(Number); 
  return (p[0]*3600) + (p[1]*60) + (p[2]||0); 
}
function formatSeconds(s) { 
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60); 
  return h > 0 ? `${h}小時 ${m}分` : `${m}分鐘`; 
}
function formatTimeHM(t) {
  if (!t) return '?';
  if (t instanceof Date) return Utilities.formatDate(t, 'GMT+8', 'HH:mm');
  if (typeof t === 'number') {
    const totalMin = Math.round(t * 24 * 60);
    return `${String(Math.floor(totalMin/60)).padStart(2,'0')}:${String(totalMin%60).padStart(2,'0')}`;
  }
  return String(t).substring(0, 5);
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



