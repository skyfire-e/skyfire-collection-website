import puppeteer from 'puppeteer-core';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://sites.google.com/view/skyf1re/dice/metal-figurines', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Get all columns in the section with "Pioneer"
const data = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  // Find section with Pioneer
  let targetSec = null;
  for (const sec of sections) {
    if (sec.textContent.includes('Pioneer')) {
      targetSec = sec;
      break;
    }
  }
  if (!targetSec) return 'No section with Pioneer found';
  
  const grid = targetSec.querySelector('.LS81yb');
  if (!grid) return 'No grid found';
  
  const result = [];
  for (let ci = 0; ci < grid.children.length; ci++) {
    const col = grid.children[ci];
    const info = { colIdx: ci };
    
    // All text
    info.fullText = col.textContent.replace(/\s+/g, ' ').trim();
    
    // Images
    const imgs = col.querySelectorAll('img');
    info.images = Array.from(imgs).map(i => ({ src: i.src.substring(0,60), alt: i.alt }));
    
    // Background images
    const bgs = col.querySelectorAll('.nQBJnb');
    info.bgCount = bgs.length;
    
    // Check for t3iYD class
    info.hasT3iYD = !!col.querySelector('.t3iYD');
    
    // Classes
    info.classes = col.className.substring(0, 100);
    
    // H2
    info.h2 = Array.from(col.querySelectorAll('h2')).map(h => h.textContent.trim());
    
    // P
    info.p = Array.from(col.querySelectorAll('p')).map(p => p.textContent.trim());
    
    result.push(info);
  }
  return result;
});

console.log(JSON.stringify(data, null, 2));
await browser.close();
