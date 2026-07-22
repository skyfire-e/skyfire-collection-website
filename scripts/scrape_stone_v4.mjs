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

// Extract items using the triple-cell pattern
const items = await page.evaluate(() => {
  const cells = document.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
  
  // Get full data for each cell
  const cellData = [];
  cells.forEach((cell, ci) => {
    const imgUrls = new Set();
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

    const textEls = cell.querySelectorAll('span, h1, h2, h3, h4, div, p');
    const texts = [];
    textEls.forEach(el => {
      const t = el.textContent.trim();
      if (t && el.children.length === 0) texts.push(t);
    });
    
    cellData.push({
      ci,
      imgCount: imgUrls.size,
      imgUrls: Array.from(imgUrls),
      texts,
      allText: cell.textContent.trim(),
    });
  });

  // Group into triples and extract items
  // Each item = 3 cells: [image+title, image-only(same), text-title]
  const items = [];
  
  // Only process the product sections (not the header)
  // Product sections start where cell has both images and text
  for (let i = 0; i < cellData.length; i++) {
    const cell = cellData[i];
    if (cell.imgCount > 0 && cell.allText.length > 0) {
      // This is the start of a product group
      const titleText = cell.allText;
      
      // Get both this cell's images AND the next cell's images
      const images = new Set(cell.imgUrls);
      if (i + 1 < cellData.length && cellData[i + 1].imgCount > 0) {
        cellData[i + 1].imgUrls.forEach(u => images.add(u));
      }
      
      // Skip the next 2 cells (image-only and text-only)
      i += 2;
      
      items.push({
        title: titleText,
        images: Array.from(images),
      });
    }
  }
  
  return items;
});

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" - ${item.images.length} images`);
  item.images.forEach((url, j) => console.log(`       img ${j+1}: ${url.slice(0, 80)}...`));
});

// Download images
console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
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
const mapping = items.map((item, i) => {
  // Parse title to extract name and author
  const parenMatch = item.title.match(/^(.+?)\s*\(([^)]+)\)$/);
  const title = parenMatch ? parenMatch[1].trim() : item.title;
  const author = parenMatch ? parenMatch[2].trim() : '';
  return {
    title,
    author,
    images: item.images.map((_, j) => `stone-dice-${i + 1}-${j + 1}.jpg`),
  };
});
writeFileSync('stone-dice-mapping.json', JSON.stringify(mapping, null, 2));
console.log('\nMapping saved:');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
