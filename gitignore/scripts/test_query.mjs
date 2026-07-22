import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Try the same approach as scrape_all.mjs
const result = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  console.log('sections found:', sections.length);
  
  const allData = [];
  
  sections.forEach((section, si) => {
    const sectionText = section.textContent.trim().slice(0, 200);
    const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
    
    const sectionInfo = {
      index: si,
      text: sectionText,
      cellCount: cells.length,
      cells: [],
    };
    
    cells.forEach((cell, ci) => {
      const imgs = cell.querySelectorAll('img');
      const imgSrcs = [];
      imgs.forEach(img => {
        if (img.src) imgSrcs.push(img.src.slice(0, 120));
      });
      
      // Also check background images
      const bgImgs = [];
      const allEls = cell.querySelectorAll('*');
      allEls.forEach(el => {
        try {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
            bgImgs.push(bg.slice(0, 100));
          }
        } catch(e) {}
      });
      
      sectionInfo.cells.push({
        ci,
        imgCount: imgs.length,
        imgSrcs,
        bgCount: bgImgs.length,
        bgImages: bgImgs.slice(0, 3),
        text: cell.textContent.trim().slice(0, 150),
      });
    });
    
    // Also try to find ALL img elements in the page
    const allImgs = document.querySelectorAll('img');
    
    allData.push({
      sectionInfo,
      totalImagesOnPage: allImgs.length,
      pageImages: Array.from(allImgs).map(i => ({ src: (i.src || '').slice(0, 100), alt: (i.alt || '').slice(0, 50) })),
    });
  });
  
  return allData;
});

console.log('Results:');
console.log(JSON.stringify(result, null, 2).slice(0, 5000));

await browser.close();
