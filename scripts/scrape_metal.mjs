import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/metal-dice';
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

  const cellData = [];
  cells.forEach((cell, ci) => {
    const imgUrls = new Set();
    const bgUrls = new Set();

    // Check for regular img elements
    const imgs = cell.querySelectorAll('img');
    imgs.forEach(img => {
      if (img.src && img.src.includes('sitesv-images')) imgUrls.add(img.src);
    });

    // Check for CSS background images (as seen in Stone Dice)
    const allEls = cell.querySelectorAll('*');
    allEls.forEach(el => {
      try {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
          bgUrls.add(bg.replace(/^url\(["']?|["']?\)$/g, ''));
        }
      } catch(e) {}
    });

    const textEls = cell.querySelectorAll('span, h1, h2, h3, h4, div, p');
    const texts = [];
    textEls.forEach(el => {
      const t = el.textContent.trim();
      if (t && el.children.length === 0 && t.length > 0) texts.push(t);
    });

    cellData.push({
      ci,
      imgCount: imgUrls.size + bgUrls.size,
      imgUrls: Array.from(imgUrls),
      bgUrls: Array.from(bgUrls),
      texts,
      allText: cell.textContent.trim(),
    });
  });

  // Group into triples and extract items
  const items = [];
  for (let i = 0; i < cellData.length; i++) {
    const cell = cellData[i];
    if (cell.imgCount > 0 && cell.allText.length > 0) {
      const rawTitle = cell.allText;
      const images = new Set([...cell.imgUrls, ...cell.bgUrls]);

      // Skip the next cell if it has the same image (shared image cell)
      if (i + 1 < cellData.length && cellData[i + 1].imgCount > 0) {
        // no-op, this cell is the shared image — no text to add
        i += 1;
      }

      items.push({
        title: rawTitle,
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
    const filename = `metal-dice-${i + 1}-${j + 1}.jpg`;

    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  ${filename} (${kb}KB) \u2192 ${item.title.slice(0,40)}`);
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

// Save mapping
function parseTitle(raw) {
  // Try to extract title and author from patterns like:
  // "Title (by Author)" or "Title (extra info)" or "Title (by Author)(extra)"
  let title = raw;
  let author = '';
  let extra = '';

  const byMatch = raw.match(/\(by\s+([^)]+)\)/i);
  if (byMatch) {
    author = byMatch[1].trim();
    title = raw.replace(/\s*\(by\s+[^)]+\)\s*/i, '').trim();
  }

  // Extract remaining parenthetical as extra info (hollow, material, etc.)
  const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    extra = parenMatch[2].trim();
    title = parenMatch[1].trim();
  }

  // Clean up — if title ends up empty, use the raw
  title = title || raw;
  return { title, author, extra };
}

const mapping = items.map((item, i) => {
  const parsed = parseTitle(item.title);
  return {
    title: parsed.title,
    author: parsed.author,
    extra: parsed.extra,
    images: item.images.map((_, j) => `metal-dice-${i + 1}-${j + 1}.jpg`),
  };
});
writeFileSync('metal-dice-mapping.json', JSON.stringify(mapping, null, 2));
console.log('\nMapping saved:');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
