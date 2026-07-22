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

// Deep dive into how items are structured
const dump = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const result = [];
  sections.forEach((sec, si) => {
    const grid = sec.querySelector('.LS81yb');
    if (!grid) return;
    const cols = grid.children;
    const items = [];
    for (let ci = 0; ci < cols.length; ci++) {
      const col = cols[ci];
      const info = { idx: ci };
      
      // Get all p tags and their exact text
      const pTags = col.querySelectorAll('p');
      const lines = [];
      pTags.forEach(p => {
        const txt = p.textContent.trim();
        if (txt) lines.push(txt);
      });
      info.lines = lines;
      
      // Image check
      const img = col.querySelector('.t3iYD img');
      info.hasImg = !!img;
      info.imgSrc = img && img.src ? img.src.substring(0,60) : null;
      
      // Carousel
      const carousel = col.querySelectorAll('.nQBJnb');
      info.carousel = carousel.length;
      
      // Check if this cell has any content at all
      info.hasContent = lines.length > 0 || info.hasImg || info.carousel > 0;
      
      items.push(info);
    }
    if (items.length > 0) result.push({ section: si, colCount: cols.length, items });
  });
  return result;
});

let total = 0;
dump.forEach(s => {
  console.log(`\nSection ${s.section} (${s.colCount} cols):`);
  s.items.forEach(item => {
    if (item.hasContent) {
      total++;
      console.log(`  Cell ${item.idx}: lines=[${item.lines.map(l=>'"'+l.substring(0,60)+'"').join(', ')}] img=${item.hasImg} car=${item.carousel}`);
    }
  });
});
console.log(`\nTotal items with content: ${total}`);

await browser.close();
