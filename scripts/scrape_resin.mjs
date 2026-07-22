import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/resin-dice';
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

// Extract items
const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const items = [];

  sections.forEach(section => {
    // Each section row has item columns. Each item column has:
    //   - image in .t3iYD img or background-image carousel
    //   - title in h2 span.C9DxTc
    //   - optional extra text in p span.C9DxTc
    const cols = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');

    cols.forEach(col => {
      // Find image
      const imgEl = col.querySelector('.t3iYD img');
      let imageUrl = null;
      let bgUrls = [];

      if (imgEl && imgEl.src && imgEl.src.includes('sitesv-images')) {
        imageUrl = imgEl.src;
      }

      // Check for carousel (CSS background-image)
      const carouselSlides = col.querySelectorAll('.nQBJnb');
      carouselSlides.forEach(slide => {
        const bg = slide.style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
          bgUrls.push(bg.replace(/^url\(["']?|["']?\)$/g, ''));
        }
      });

      // Find title
      const titleEl = col.querySelector('h2 .C9DxTc');
      if (!titleEl) return;
      const title = titleEl.textContent.trim();
      if (!title) return;

      // Find extra text (author, description)
      const extraEl = col.querySelector('p .C9DxTc');
      const extra = extraEl ? extraEl.textContent.trim() : '';

      const images = [];
      if (imageUrl) images.push(imageUrl);
      if (bgUrls.length) bgUrls.forEach(u => images.push(u));

      if (images.length > 0) {
        items.push({ title, extra, images });
      }
    });
  });

  return items;
});

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" ${item.extra ? '(' + item.extra + ')' : ''} - ${item.images.length} images`);
});

// Download images
console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `resin-dice-${i + 1}-${j + 1}.jpg`;

    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  ${filename} (${kb}KB) \u2192 ${item.title.slice(0, 40)}`);
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

// Parse and save mapping
function parseTitle(raw) {
  let title = raw;
  let author = '';

  const byMatch = raw.match(/\(by\s+([^)]+)\)/i);
  if (byMatch) {
    author = byMatch[1].trim();
    title = raw.replace(/\s*\(by\s+[^)]+\)\s*/i, '').trim();
  }

  // Save extra info (sharp edge, liquid core, rechargeable) back to title as suffix
  const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    title = parenMatch[1].trim();
  }

  title = title || raw;
  return { title, author };
}

const mapping = items.map((item, i) => {
  const parsed = parseTitle(item.title);
  // Use extra as author if no author found in title
  const author = parsed.author || '';
  const images = item.images.map((_, j) => `resin-dice-${i + 1}-${j + 1}.jpg`);
  return { title: parsed.title, author, images };
});

writeFileSync('resin-dice-mapping.json', JSON.stringify(mapping, null, 2));
console.log('\nMapping saved:');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
