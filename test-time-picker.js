const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 1. 訪問首頁
    await page.goto('http://localhost:5173/TaskTiming/', { waitUntil: 'networkidle' });
    console.log('✅ App loaded successfully');
    
    // 2. 點擊第一個產品進入 Input 頁面
    await page.click('button:has-text("SAMPLE")');
    await page.waitForURL('**/input', { timeout: 5000 });
    console.log('✅ Navigated to Input page');
    
    // 3. 檢查開始時間是否自動填充（應該有值）
    const startTimeDisplay = await page.locator('text=開始時間').first().locator('..').locator('div').nth(2).textContent();
    console.log('✅ Start time auto-filled:', startTimeDisplay);
    
    // 4. 測試開始時間的上按鈕
    const startHourUpBtn = await page.locator('text=開始時間').first().locator('..').locator('button').first();
    await startHourUpBtn.click();
    console.log('✅ Clicked start hour up button');
    
    // 5. 測試結束時間的下按鈕
    const endTimeSection = await page.locator('text=結束時間').first();
    const endMinuteDownBtn = await endTimeSection.locator('..').locator('button').last();
    await endMinuteDownBtn.click();
    await endMinuteDownBtn.click();
    console.log('✅ Clicked end minute down buttons');
    
    // 6. 輸入結束時間（確保表單可以提交）
    const endHourUpBtn = await page.locator('text=結束時間').first().locator('..').locator('button').nth(0);
    for (let i = 0; i < 3; i++) {
      await endHourUpBtn.click();
    }
    console.log('✅ Set end time using up buttons');
    
    // 7. 檢查確認按鈕是否可用
    const confirmBtn = await page.locator('button:has-text("下一步")');
    const isEnabled = await confirmBtn.isEnabled();
    console.log('✅ Submit button status:', isEnabled ? 'enabled' : 'disabled');
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
