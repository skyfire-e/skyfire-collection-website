import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/acrylic-dice';
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

// Debug: dump some structure
const structure = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const result = [];
  sections.forEach((sec, si) => {
    // Get all item columns directly inside the section grid
    const items = [];
    const grid = sec.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const info = { colIdx: ci, texts: [], img: null };
      // Get all text from p > span.C9DxTc
      const spans = col.querySelectorAll('p .C9DxTc');
      spans.forEach(sp => {
        const txt = sp.textContent.trim();
        if (txt) info.texts.push(txt);
      });
      // Get image
      const img = col.querySelector('.t3iYD img');
      if (img && img.src) info.img = img.src.substring(0, 80);
      if (info.texts.length > 0 || info.img) items.push(info);
    }
    if (items.length > 0) result.push({ sectionIdx: si, cols: items.length });
  });
  return result;
});
console.log('Section structure:', JSON.stringify(structure, null, 2));

const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const items = [];

  sections.forEach(section => {
    const grid = section.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;

    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];

      // Get image
      const imgEl = col.querySelector('.t3iYD img');
      let imageUrl = null;
      let bgUrls = [];

      if (imgEl && imgEl.src && imgEl.src.includes('sitesv-images')) {
        imageUrl = imgEl.src;
      }

      // Check for carousel
      const carouselSlides = col.querySelectorAll('.nQBJnb');
      carouselSlides.forEach(slide => {
        const bg = slide.style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('sitesv-images')) {
          bgUrls.push(bg.replace(/^url\(["']?|["']?\)$/g, ''));
        }
      });

      // Get ALL text from p tags — concatenate spans within each p
      const pTags = col.querySelectorAll('p');
      const texts = [];
      pTags.forEach(p => {
        const txt = p.textContent.trim();
        if (txt) texts.push(txt);
      });

      if (texts.length === 0) return; // no text = not an item
      const title = texts[0];
      const extra = texts.length > 1 ? texts[1] : '';

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

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" ${item.extra ? '(' + item.extra + ')' : ''} - ${item.images.length} images`);
});

console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `acrylic-dice-${i + 1}-${j + 1}.jpg`;

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

// Parse title to separate title from author
// Rules:
// 1. If title contains "(by X)" or "(by X, Y)" → author = X (or X, Y), remove from title
// 2. Otherwise if extra text contains "(by X)" → use that as author
// 3. Extra text like "(d4, 2d6, ...)" is NOT author, keep just the first line as title
// 4. Extra text like "(8mm)", "(replica, 5d20)", "(metal+plastic by Q-workshop)" → NOT author
function parseItem(rawTitle, rawExtra) {
  let title = rawTitle;
  let author = '';

  // Check if title itself has (by X)
  const byMatch = title.match(/\(by\s+(.+?)\)\s*$/i);
  if (byMatch) {
    author = byMatch[1].trim();
    title = title.replace(/\s*\(by\s+.+?\)\s*$/i, '').trim();
  }

  // Check extra for (by X) — only if no author found yet
  if (!author && rawExtra) {
    const extraByMatch = rawExtra.match(/\(by\s+(.+?)\)\s*$/i);
    if (extraByMatch) {
      author = extraByMatch[1].trim();
    }
  }

  // Clean up any trailing parenthetical descriptions from title (like dice info)
  // Only remove parenthetical that look like dice notation or specs
  // e.g., "(d4, 2d6, d8, 2d10, d12)", "(10d8)", "(8mm)", "(replica, 5d20)"
  // But KEEP author text in title if there was no explicit author extraction
  const specMatch = title.match(/^(.+?)\s*\((?:d\d+|replica|mm)\)/i);
  if (specMatch) {
    title = specMatch[1].trim();
  }

  title = title || rawTitle;

  // Clean up extra info like "(metal+plastic by Q-workshop)" — extract author part
  if (!author && rawExtra) {
    const mpMatch = rawExtra.match(/\([^)]*by\s+(.+?)\)/i);
    if (mpMatch) {
      author = mpMatch[1].trim();
    }
  }

  return { title, author };
}

const mapping = items.map((item, i) => {
  const parsed = parseItem(item.title, item.extra);
  const images = item.images.map((_, j) => `acrylic-dice-${i + 1}-${j + 1}.jpg`);
  return { title: parsed.title, author: parsed.author, images };
});

const mappingPath = 'acrylic-dice-mapping.json';
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
console.log('\nMapping saved to ' + mappingPath + ':');
console.log(JSON.stringify(mapping, null, 2));

await browser.close();
