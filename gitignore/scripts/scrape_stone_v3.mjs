import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';
const UPLOAD_DIR = 'uploads';

mkdirSync(UPLOAD_DIR, { recursive: true });

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

// Full analysis of all sections and cells
const analysis = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const result = [];

  sections.forEach((section, si) => {
    const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
    const cellData = [];

    cells.forEach((cell, ci) => {
      const texts = [];
      const imgUrls = new Set();
      
      // Get all background images
      const allEls = cell.querySelectorAll('*');
      allEls.forEach(el => {
        try {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
            const url = bg.replace(/^url\(["']?|["']?\)$/g, '');
            imgUrls.add(url);
          }
        } catch(e) {}
      });

      // Get text content
      const cellTexts = [];
      const textEls = cell.querySelectorAll('span, div, p, h1, h2, h3, h4');
      textEls.forEach(el => {
        const t = el.textContent.trim();
        if (t && el.children.length === 0) {
          cellTexts.push(t);
        }
      });

      const fullUrls = Array.from(imgUrls);
      cellData.push({
        ci,
        imgCount: imgUrls.size,
        imgUrls: fullUrls,
        imgUrlsShort: fullUrls.map(u => u.slice(0, 100)),
        texts: cellTexts.slice(0, 5),
        allText: cell.textContent.trim().slice(0, 100),
      });
    });

    result.push({
      sectionIdx: si,
      sectionText: section.textContent.trim().slice(0, 200),
      cellCount: cells.length,
      cells: cellData,
    });
  });

  return result;
});

console.log('\n=== FULL ANALYSIS ===');
analysis.forEach(s => {
  console.log(`\nSection ${s.sectionIdx}: "${s.sectionText.slice(0, 80)}..." (${s.cellCount} cells)`);
  s.cells.forEach(c => {
    console.log(`  Cell ${c.ci}: ${c.imgCount} images, texts: ${JSON.stringify(c.texts)}, allText: "${c.allText}"`);
  });
});

// Now manually extract items from this data
const items = [];

for (const section of analysis) {
  let currentItem = null;
  
  for (const cell of section.cells) {
    if (cell.texts.length > 0 && cell.imgCount === 0) {
      // This is a text-only cell with a title
      const title = cell.texts[0];
      // Check if there's a parenthetical author
      const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)$/);
      const itemTitle = parenMatch ? parenMatch[1].trim() : title;
      const author = parenMatch ? parenMatch[2].trim() : '';
      
      if (title !== 'Stone Dice' && title.length > 2) {
        if (currentItem) items.push(currentItem);
        currentItem = { title: itemTitle, author, images: new Set() };
      }
    }
    
    if (currentItem && cell.imgCount > 0) {
      cell.imgUrls.forEach(u => currentItem.images.add(u));
    }
  }
  
  if (currentItem) items.push(currentItem);
}

console.log('\n=== DETECTED ITEMS ===');
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}"${item.author ? ' (' + item.author + ')' : ''} - ${item.images.size} images`);
  const imgs = Array.from(item.images);
  imgs.forEach((url, j) => console.log(`       img ${j+1}: ${url.slice(0, 80)}...`));
});

// Download images
console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const imgs = Array.from(item.images);
  for (let j = 0; j < imgs.length; j++) {
    const url = imgs[j];
    const filename = `stone-dice-${i + 1}-${j + 1}.jpg`;
    
    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  ${filename} (${kb}KB) → ${item.title}`);
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

// Save mapping
const mapping = items.map((item, i) => ({
  title: item.title,
  author: item.author,
  images: Array.from(item.images).map((_, j) => `stone-dice-${i + 1}-${j + 1}.jpg`),
}));
writeFileSync('stone-dice-mapping.json', JSON.stringify(mapping, null, 2));
console.log('\nMapping saved to stone-dice-mapping.json');

await browser.close();
