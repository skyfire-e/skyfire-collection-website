import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/wooden-dice';
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

// First check structure
const structure = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const result = [];
  sections.forEach((sec, si) => {
    const grid = sec.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;
    const items = [];
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const pSpans = col.querySelectorAll('p .C9DxTc');
      const h2Spans = col.querySelectorAll('h2 .C9DxTc');
      const img = col.querySelector('.t3iYD img');
      const info = { colIdx: ci, texts: [], h2texts: [], img: null };
      pSpans.forEach(sp => { const t = sp.textContent.trim(); if (t) info.texts.push(t); });
      h2Spans.forEach(sp => { const t = sp.textContent.trim(); if (t) info.h2texts.push(t); });
      if (img && img.src) info.img = img.src.substring(0, 60);
      if (info.texts.length > 0 || info.h2texts.length > 0 || info.img) items.push(info);
    }
    if (items.length > 0) result.push({ sectionIdx: si, cols: items.length, sample: items[0] });
  });
  return result;
});
console.log('Structure:');
console.log(JSON.stringify(structure, null, 2));

// Now extract items
const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const items = [];

  sections.forEach(section => {
    const grid = section.querySelector('.LS81yb');
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

      // Try to get title from h2 first, then p
      let title = '';
      let extra = '';
      const h2Spans = col.querySelectorAll('h2 .C9DxTc');
      const pSpans = col.querySelectorAll('p .C9DxTc');

      const h2Texts = [];
      h2Spans.forEach(sp => { const t = sp.textContent.trim(); if (t) h2Texts.push(t); });

      if (h2Texts.length > 0) {
        title = h2Texts.join(' ');
      } else {
        // Get all text from p tags
        const pTags = col.querySelectorAll('p');
        const texts = [];
        pTags.forEach(p => {
          const txt = p.textContent.trim();
          if (txt) texts.push(txt);
        });
        if (texts.length > 0) {
          title = texts[0];
          extra = texts.length > 1 ? texts[1] : '';
        }
      }

      if (!title) return;

      const images = [];
      if (imageUrl) images.push(imageUrl);
      if (bgUrls.length) bgUrls.forEach(u => images.push(u));

      if (images.length > 0) {
        items.push({ title, extra, images });
      }
    }
  });

  return items;
});

console.log(`\nFound ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" ${item.extra ? '(' + item.extra + ')' : ''} - ${item.images.length} images`);
});

console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `wooden-dice-${i + 1}-${j + 1}.jpg`;

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

function parseItem(rawTitle, rawExtra) {
  let title = rawTitle;
  let author = '';

  const byMatch = title.match(/\(by\s+(.+?)\)\s*$/i);
  if (byMatch) {
    author = byMatch[1].trim();
    title = title.replace(/\s*\(by\s+.+?\)\s*$/i, '').trim();
  }

  if (!author && rawExtra) {
    const extraByMatch = rawExtra.match(/\(by\s+(.+?)\)\s*$/i);
    if (extraByMatch) {
      author = extraByMatch[1].trim();
    }
  }

  const specMatch = title.match(/^(.+?)\s*\((?:d\d+|replica|mm)\)/i);
  if (specMatch) {
    title = specMatch[1].trim();
  }

  if (!author && rawExtra) {
    const mpMatch = rawExtra.match(/\([^)]*by\s+(.+?)\)/i);
    if (mpMatch) {
      author = mpMatch[1].trim();
    }
  }

  return { title: title || rawTitle, author };
}

const mapping = items.map((item, i) => {
  const parsed = parseItem(item.title, item.extra);
  const images = item.images.map((_, j) => `wooden-dice-${i + 1}-${j + 1}.jpg`);
  return { title: parsed.title, author: parsed.author, images };
});

const mappingPath = 'wooden-dice-mapping.json';
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
console.log('\nMapping saved:');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
