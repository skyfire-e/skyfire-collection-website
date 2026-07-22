import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://sites.google.com/view/skyf1re/dice/acrylic-figurines', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const items = [];
  sections.forEach((sec, si) => {
    const grid = sec.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const img = col.querySelector('.t3iYD img');
      if (!img || !img.src.includes('sitesv-images')) continue;
      
      // Get full text content
      const fullText = col.textContent.replace(/\s+/g, ' ').trim();
      
      // Get image URL
      const imgUrl = img.src;
      
      items.push({ secIdx: si, colIdx: ci, text: fullText.substring(0, 200), img: imgUrl.substring(0, 80) });
    }
  });
  return items;
});

console.log('Items found:', items.length);
items.forEach((item, i) => {
  console.log((i+1) + '. text="' + item.text + '"');
});

// Also look at raw HTML to understand structure better
const html = await page.content();
writeFileSync('acrylic-fig-page.html', html, 'utf8');
console.log('\nHTML saved (' + html.length + ' bytes)');

await browser.close();
