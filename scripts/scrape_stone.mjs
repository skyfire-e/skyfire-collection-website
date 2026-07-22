import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';
const SECTION = 'dice';
const CATEGORY_ID = 'stone-dice';
const CATEGORY_LABEL = 'Stone Dice';
const UPLOAD_DIR = 'uploads';

mkdirSync(UPLOAD_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

console.log(`Scraping ${URL}...`);

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

// Get all text and images
const pageText = await page.evaluate(() => document.body.innerText);
console.log('\n=== PAGE TEXT ===');
console.log(pageText);

// Get all image-containing cells with text
const items = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const results = [];

  sections.forEach((section) => {
    const cells = section.querySelectorAll('[class*="hJDwNd-"], [class*="AhqUyc-"]');
    const sectionItems = [];
    
    cells.forEach((cell) => {
      const img = cell.querySelector('img[src*="sitesv-images"]');
      if (!img) return;

      const textSpans = cell.querySelectorAll('span, div, p');
      const texts = [];
      textSpans.forEach(el => {
        const t = el.textContent.trim();
        if (t && el.children.length === 0 && t.length > 0) {
          texts.push(t);
        }
      });

      const allText = cell.textContent.trim();
      if (allText.length === 0) return;

      sectionItems.push({
        imgSrc: img.src,
        texts: texts.filter((t, i, a) => a.indexOf(t) === i),
        allText,
      });
    });

    // If multiple images in section, group them (carousel)
    // Remove duplicates (empty cells with same imgSrc)
    const seen = new Set();
    sectionItems.forEach(item => {
      const key = item.allText || item.imgSrc.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    });
  });

  return results;
});

console.log(`\n=== ITEMS (${items.length}) ===`);
items.forEach((item, i) => {
  console.log(`\nItem ${i + 1}:`);
  console.log(`  Img: ${item.imgSrc.slice(0, 100)}...`);
  console.log(`  Texts: ${JSON.stringify(item.texts)}`);
  console.log(`  AllText: "${item.allText.slice(0, 200)}"`);
});

// Also check if there are any carousel-like patterns (multiple images per item)
// Look at sections with more images than expected
const carouselInfo = await page.evaluate(() => {
  const sections = document.querySelectorAll('section.yaqOZd');
  const info = [];
  sections.forEach((s, i) => {
    const imgs = s.querySelectorAll('img[src*="sitesv-images"]');
    if (imgs.length > 0) {
      info.push({ section: i, imgCount: imgs.length });
    }
  });
  return info;
});
console.log(`\n=== SECTIONS WITH IMAGES ===`);
console.log(JSON.stringify(carouselInfo));

writeFileSync('stone-dice-scrape.json', JSON.stringify({ pageText, items, carouselInfo }, null, 2));

await browser.close();
