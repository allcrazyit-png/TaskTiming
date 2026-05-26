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

/**
 * 終極修正版：直接對位避免表頭錯誤 + 可隨時測試版
 */
function sendAdvancedSummaryEmail() {
  const recordSS = SpreadsheetApp.openById(RECORDS_SS_ID);
  const employeeSS = SpreadsheetApp.openById(PRODUCTS_SS_ID);
  
  const recordSheet = recordSS.getSheets()[0];
  const employeeSheet = employeeSS.getSheetByName("員工資料") || employeeSS.getSheets()[0];
  
  const recordData = recordSheet.getDataRange().getValues();
  const employeeData = employeeSheet.getDataRange().getValues();
  
  // 決定要抓取的日期：未來每天早上抓取「昨天」的完整資料
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 1); 
  const targetDateStr = Utilities.formatDate(targetDate, "GMT+8", "yyyy/MM/dd");
  
  // 根據你 doPost 的寫入順序，直接寫死對應的欄位索引 (完全不怕表頭名稱不符)
  const idx = { 
    op: 0,      // 作業者 (A欄)
    car: 1,     // 車型   (B欄)
    prod: 4,    // 品名   (E欄)
    date: 5,    // 日期   (F欄)
    start: 6,   // 開始時間 (G欄)
    end: 7,     // 結束時間 (H欄)
    tt: 8,      // 總工時 (I欄)
    mis: 12,    // 缺料   (M欄)
    eff: 20     // 效率   (U欄)
  };

  // 篩選符合日期的紀錄 (略過第一行表頭)
  const yesterdayRecords = recordData.slice(1).filter(row => {
    const rowDate = row[idx.date] instanceof Date ? 
      Utilities.formatDate(row[idx.date], "GMT+8", "yyyy/MM/dd") : row[idx.date];
    return rowDate === targetDateStr;
  });

  if (yesterdayRecords.length === 0) {
    GmailApp.sendEmail("allcrazy.it@gmail.com", `【數據日報】${targetDateStr} 無生產紀錄`, "", { 
      htmlBody: `<p>${targetDateStr} 指定日期無任何上傳紀錄，所以都是 0 哦！</p>` 
    });
    return;
  }

  // --- 處理統計 ---
  let statsByOperator = {}, prodEff = {}, mDef = {}, totalM = 0;
  let unspecWork = { totalTime: 0, items: [] }; 
  
  // Google Sheet 如果看到 "80%"，會自動將其轉為數值 0.8
  // 所以如果是數值，必須 x 100 轉回百分比；如果是字串 "80%" 則直接剝離 %
  const parseE = (s) => {
    if (typeof s === 'number') return s * 100;
    return parseFloat(String(s).replace('%', '')) || 0;
  };

  yesterdayRecords.forEach(r => {
    const op = r[idx.op], p = r[idx.prod], car = r[idx.car], eff = parseE(r[idx.eff]);
    
    // 防呆：如果作業者是空的不算
    if (!op) return;

    if (!statsByOperator[op]) statsByOperator[op] = { effs: [], recs: [] };
    
    const isUnspecified = (String(p).includes("未指定") || String(car).includes("未指定"));

    // 只有非「未指定」的紀錄，才列入個人平均與產品最高/低效率排名
    if (!isUnspecified) {
        statsByOperator[op].effs.push(eff);
        
        if (!prodEff[p]) prodEff[p] = []; 
        prodEff[p].push(eff);
    }

    // 將時間推送至陣列，這樣無論是不是未指定，都能用來追蹤有無偷閒 (空窗期)
    statsByOperator[op].recs.push({ s: r[idx.start], e: r[idx.end] });
    
    const md = Number(r[idx.mis]) || 0; 
    if (md > 0) { 
        mDef[p] = (mDef[p] || 0) + md; 
        totalM += md; 
    }

    if (isUnspecified) {
      const sec = timeStringToSeconds(r[idx.tt]);
      unspecWork.totalTime += sec;
      unspecWork.items.push(`${p} (${r[idx.tt]})`);
    }
  });

  // 計算未上傳人員
  const allEmp = employeeData.slice(1).map(r => `[${r[0]}] ${r[1]}`);
  const missEmp = allEmp.filter(e => !Object.keys(statsByOperator).includes(e));
  
  // 計算異常空窗
  const toMin = (t) => {
    if (!t) return 0;
    if (t instanceof Date) return t.getHours()*60 + t.getMinutes();
    if (typeof t === 'number') return Math.round(t * 24 * 60);
    const x = String(t).split(':').map(Number);
    return x[0]*60 + x[1];
  };

  const WORK_START = 8 * 60;    // 08:00
  const WORK_END   = 17 * 60;   // 17:00
  const LUNCH_START = 12 * 60;  // 12:00
  const LUNCH_END   = 13 * 60;  // 13:00

  const fmt = (m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const calcEffectiveGap = (start, end) => {
    const cs = Math.max(start, WORK_START);
    const ce = Math.min(end, WORK_END);
    if (ce <= cs) return { gap: 0, cs, ce };
    const lunch = Math.max(0, Math.min(ce, LUNCH_END) - Math.max(cs, LUNCH_START));
    return { gap: (ce - cs) - lunch, cs, ce };
  };

  let idles = [];
  Object.keys(statsByOperator).forEach(op => {
    const recs = statsByOperator[op].recs.sort((a,b) => toMin(a.s) - toMin(b.s));

    // 連續兩筆之間的空窗
    for (let i = 0; i < recs.length - 1; i++) {
        if (!recs[i].e || !recs[i+1].s) continue;
        const { gap, cs, ce } = calcEffectiveGap(toMin(recs[i].e), toMin(recs[i+1].s));
        if (gap > 60) idles.push(`${op} (${fmt(cs)} → ${fmt(ce)}，空窗 ${gap} 分鐘)`);
    }

    // 最後一筆到下班時間的空窗（偵測中途請假/早退）
    // 只在最後一筆結束時間早於 17:00 時才檢查，避免與連續空窗重複計算
    const last = recs[recs.length - 1];
    if (last && last.e && toMin(last.e) < WORK_END) {
        const { gap, cs, ce } = calcEffectiveGap(toMin(last.e), WORK_END);
        if (gap > 60) idles.push(`${op} (${fmt(cs)} → ${fmt(ce)}，空窗 ${gap} 分鐘)`);
    }
  });

  // 排序效率
  const avgEffs = Object.keys(prodEff).map(p => ({ 
      n: p, 
      v: prodEff[p].reduce((a,b)=>a+b,0)/prodEff[p].length 
  })).sort((a,b)=>b.v-a.v);

  const htmlBody = `
    <div style="font-family: 'Microsoft JhengHei', sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; padding: 20px;">
      <h2 style="color: #2563eb; border-bottom: 3px solid #3b82f6;">⭐ 測試/今日數據日報 (${targetDateStr})</h2>
      <p><b>✨ 最高效率產品：</b> ${avgEffs[0]?.n || '無'} <span style="color:#15803d; font-weight:bold;">(${avgEffs[0] ? avgEffs[0].v.toFixed(1) : 0}%)</span></p>
      <p><b>⚠️ 最低效率產品：</b> ${avgEffs[avgEffs.length-1]?.n || '無'} <span style="color:#b91c1c; font-weight:bold;">(${avgEffs[avgEffs.length-1] ? avgEffs[avgEffs.length-1].v.toFixed(1) : 0}%)</span></p>
      
      <div style="background: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #fdba74; margin: 15px 0;">
        <h3 style="margin: 0 0 10px 0; color: #9a3412; font-size: 15px;">🔥 品質：成型不良統計</h3>
        ${totalM > 0 ? Object.keys(mDef).map(p => `<p style="margin:4px 0">• <b>${p}</b>: <span style="color:#ea580c; font-weight:bold;">${mDef[p]} Pcs</span></p>`).join('') : '<p style="margin:0; color:#c2410c;">今日無成型不良紀錄 👍</p>'}
      </div>
      
      <h3 style="font-size: 15px; border-left: 4px solid #3b82f6; padding-left: 8px;">👤 員工平均效率</h3>
      ${Object.keys(statsByOperator).map(op => {
        const effs = statsByOperator[op].effs;
        const avgDisplay = effs.length > 0 ? (effs.reduce((a,b)=>a+b,0)/effs.length).toFixed(1) + '%' : '<span style="font-weight:normal;color:#94a3b8;font-size:13px;">無效率 (純未指定)</span>';
        return `<p style="margin:4px 0">• ${op}: <b style="color:#1e293b;">${avgDisplay}</b></p>`;
      }).join('')}
      
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 13.5px;">
        <h3 style="margin: 0 0 10px 0; color: #475569; font-size: 15px;">⚠️ 異常監控</h3>
        <p style="margin:6px 0"><b>❗ 未上傳：</b> <span style="color:#ef4444;">${missEmp.join('、') || '無'}</span></p>
        <p style="margin:6px 0"><b>❗ 超過1小時空窗：</b> ${idles.length === 0 ? '<span style="color:#f59e0b;">無</span>' : idles.map(i => `<br>&nbsp;&nbsp;• <span style="color:#f59e0b;">${i}</span>`).join('')}</p>
        <p style="margin:6px 0"><b>❓ 未指定項目時數：</b> 共 <b style="color:#334155;">${formatSeconds(unspecWork.totalTime)}</b></p>
      </div>
      
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 25px;">瑞全企業 - 作業計時管理系統自動發送</p>
    </div>
  `;

  GmailApp.sendEmail("allcrazy.it@gmail.com", `【數據日報測試】${targetDateStr} 成型品質與效率分析`, "", { htmlBody: htmlBody });
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



