import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/citadel-skaven';
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
  sections.forEach(section => {
    const grid = section.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];

      // Image
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

      const images = [];
      if (imageUrl) images.push(imageUrl);
      if (bgUrls.length) bgUrls.forEach(u => images.push(u));

      // Skip cells with no images at all
      if (images.length === 0) return;

      // Text lines
      const pTags = col.querySelectorAll('p');
      const lines = [];
      pTags.forEach(p => {
        const txt = p.textContent.trim();
        if (txt) lines.push(txt);
      });

      // title = first line, author = remaining lines joined
      const title = lines.length > 0 ? lines[0] : '(no title)';
      const author = lines.length > 1 ? lines.slice(1).join(', ') : '';

      items.push({ title, author, images });
    }
  });
  return items;
});

console.log(`Found ${items.length} items:`);
items.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title.substring(0,60)}" | author: "${item.author.substring(0,40)}" - ${item.images.length} imgs`);
});

console.log('\n=== DOWNLOADING ===');
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  for (let j = 0; j < item.images.length; j++) {
    const url = item.images[j];
    const filename = `citadel-skaven-${i + 1}-${j + 1}.jpg`;
    if (existsSync(`${UPLOAD_DIR}/${filename}`)) {
      console.log(`  ${filename} already exists`);
      continue;
    }
    const imgPage = await browser.newPage();
    try {
      const response = await imgPage.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const buffer = await response.buffer();
      writeFileSync(`${UPLOAD_DIR}/${filename}`, buffer);
      const kb = (buffer.length / 1024).toFixed(0);
      console.log(`  ${filename} (${kb}KB)`);
    } catch (err) {
      console.log(`  FAILED: ${filename} - ${err.message}`);
    }
    await imgPage.close();
  }
}

// --- UPLOAD ---
console.log('\n=== UPLOADING ===');
const itemsFile = './data/items.json';
const db = JSON.parse(readFileSync(itemsFile, 'utf8'));
const CATEGORY = 'citadel-skaven';
const SECTION = 'miniatures';
const settings = JSON.parse(readFileSync('./data/settings.json', 'utf8'));

items.forEach((item, i) => {
  const imgs = item.images.map((_, j) => `citadel-skaven-${i + 1}-${j + 1}.jpg`).filter(f => existsSync(`${UPLOAD_DIR}/${f}`));
  const newItem = {
    id: Date.now() + i,
    section: SECTION,
    category: CATEGORY,
    title: item.title,
    author: item.author,
    price: '',
    recaster: '',
    combatPoints: '',
    status: '',
    image: imgs.length > 0 ? '/uploads/' + imgs[0] : (settings.defaultImage || '/images/default.svg'),
    images: imgs.map(f => '/uploads/' + f),
    createdAt: new Date().toISOString()
  };
  db.push(newItem);
  console.log(`  ${i+1}. "${item.title.substring(0,50)}" ✓`);
});

writeFileSync(itemsFile, JSON.stringify(db, null, 2), 'utf8');
console.log(`\nTotal items in file: ${db.length}`);
await browser.close();
