import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = 'https://sites.google.com/view/skyf1re/dice/metal-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForNetworkIdle({ idleTime: 5000 });

const fullHTML = await page.evaluate(() => document.documentElement.outerHTML);
writeFileSync('metal-dice-full.html', fullHTML);
console.log('Full HTML saved, length:', fullHTML.length);

// Also find where the images actually are in the DOM
const imgInfo = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img[src*="sitesv-images"]');
  const results = [];
  imgs.forEach((img, i) => {
    // Get the selector path
    let el = img;
    let path = [];
    while (el && el !== document.body) {
      const tag = el.tagName.toLowerCase();
      const cls = el.className ? '.' + el.className.split(' ').filter(Boolean).join('.') : '';
      const idx = Array.from(el.parentElement?.children || []).indexOf(el);
      path.unshift(`${tag}${cls}[${idx}]`);
      el = el.parentElement;
    }
    path.unshift('body');
    results.push({ idx: i, selector: path.join(' > ') });
  });
  return results;
});

console.log('Image paths:');
imgInfo.forEach(info => console.log(`  [${info.idx}] ${info.selector.slice(0, 300)}`));

// Also get the text elements in order
const textElements = await page.evaluate(() => {
  // Find all text elements that are visible
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null, false);
  const texts = [];
  let node;
  while (node = walker.nextNode()) {
    const tag = node.tagName?.toLowerCase();
    if (['script', 'style', 'noscript', 'svg'].includes(tag)) continue;
    const text = node.textContent?.trim();
    if (text && text.length > 1 && node.children.length === 0) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        texts.push({
          tag,
          text: text.slice(0, 100),
          id: node.id,
          className: node.className?.slice(0, 50),
          rect: { top: Math.round(rect.top), left: Math.round(rect.left) },
        });
      }
    }
  }
  return texts;
});

// Group images and text by proximity
const imagePositions = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img[src*="sitesv-images"]');
  return Array.from(imgs).map(img => {
    const r = img.getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
  });
});

console.log(`\n${textElements.length} visible text elements, ${imagePositions.length} images`);
// Show text elements around image positions
textElements.forEach(t => console.log(`  ${t.tag} at (${t.left},${t.top}): "${t.text.slice(0, 60)}"`));

writeFileSync('metal-dice-text-elements.json', JSON.stringify({ textElements, imagePositions }, null, 2));

await browser.close();
