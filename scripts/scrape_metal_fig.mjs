import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/metal-figurines';
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

const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const items = [];

  sections.forEach((sec, si) => {
    const grid = sec.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;

    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const imgEl = col.querySelector('.t3iYD img');
      let imageUrl = null;
      let bgUrls = [];

      if (imgEl && imgEl.src && imgEl.src.includes('sitesv-images')) {
        imageUrl = imgEl.src;
      }

      const carouselSlides = col.querySelectorAll('.nQBJnb');
      carouselSlides.forEach(slide => {
        const bg = slide.style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
          bgUrls.push(bg.replace(/^url\(["']?|["']?\)$/g, ''));
        }
      });

      // Get text from h2 first, then p
      let fullText = '';
      const h2Tags = col.querySelectorAll('h2');
      if (h2Tags.length > 0) {
        const texts = [];
        h2Tags.forEach(h2 => {
          const t = h2.textContent.trim();
          if (t) texts.push(t);
        });
        fullText = texts.join(' ');
      } else {
        const pTags = col.querySelectorAll('p');
        const texts = [];
        pTags.forEach(p => {
          const t = p.textContent.trim();
          if (t) texts.push(t);
        });
        fullText = texts.join(' ');
      }

      if (!fullText) continue;
      if (!imageUrl && bgUrls.length === 0) continue; // no image at all

      const images = [];
      if (imageUrl) images.push(imageUrl);
      bgUrls.forEach(u => images.push(u));

      items.push({ title: fullText, images });
    }
  });

  return items;
});

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" - ${item.images.length} images`);
});

console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `metal-fig-${i + 1}-${j + 1}.jpg`;

    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  ${filename} (${kb}KB) -> ${item.title.slice(0, 40)}`);
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

function parseItem(raw) {
  let title = raw;
  let author = '';

  // Pattern: (by X)
  const byMatch = title.match(/\(by\s+(.+?)\)\s*$/i);
  if (byMatch) {
    author = byMatch[1].trim();
    title = title.replace(/\s*\(by\s+.+?\)\s*$/i, '').trim();
  }

  // Remove descriptive parentheticals like (hollow), (4)
  // But keep them in title if no author was found
  const parenMatch = title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    title = parenMatch[1].trim();
  }

  return { title: title || raw, author };
}

const mapping = items.map((item, i) => {
  const parsed = parseItem(item.title);
  const images = item.images.map((_, j) => `metal-fig-${i + 1}-${j + 1}.jpg`);
  return { title: parsed.title, author: parsed.author, images };
});

writeFileSync('metal-fig-mapping.json', JSON.stringify(mapping, null, 2));
console.log('\nMapping saved:');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
