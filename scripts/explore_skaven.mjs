import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/citadel-skaven';

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
      const info = { colIdx: ci, texts: [], img: null, bgImages: 0 };
      const spans = col.querySelectorAll('p .C9DxTc');
      spans.forEach(sp => {
        const txt = sp.textContent.trim();
        if (txt) info.texts.push(txt);
      });
      const img = col.querySelector('.t3iYD img');
      if (img && img.src) info.img = img.src.substring(0, 80);
      const carousel = col.querySelectorAll('.nQBJnb');
      info.bgImages = carousel.length;
      if (info.texts.length > 0 || info.img) items.push(info);
    }
    if (items.length > 0) result.push({ sectionIdx: si, cols: items.length, sampleText: items[0]?.texts?.[0]?.substring(0, 40) });
  });
  return result;
});
console.log('Structure:');
console.log(JSON.stringify(structure, null, 2));

// Full dump of first section
const full = await page.evaluate(() => {
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
      const pTags = col.querySelectorAll('p');
      const texts = [];
      pTags.forEach(p => {
        const txt = p.textContent.trim();
        if (txt) texts.push(txt);
      });
      if (texts.length === 0) return;
      const title = texts[0];
      const extra = texts.length > 1 ? texts[1] : '';
      const images = [];
      if (imageUrl) images.push(imageUrl);
      if (bgUrls.length) bgUrls.forEach(u => images.push(u));
      if (images.length > 0) {
        items.push({ title: title.substring(0, 60), extra: extra.substring(0, 60), images: images.length, imgUrl: (imageUrl || bgUrls[0] || '').substring(0, 60) });
      }
    }
  });
  return items;
});
console.log(`\nFound ${full.length} items:`);
full.forEach((item, i) => {
  console.log(`  ${i+1}. "${item.title}" ${item.extra ? '(' + item.extra + ')' : ''} - ${item.images} images`);
});

await browser.close();
