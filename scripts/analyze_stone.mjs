import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Capture images with metadata
const capturedImages = [];

page.on('response', async (response) => {
  const url = response.url();
  if (url.includes('sitesv-images') && url.endsWith('=w16383') && response.status() === 200) {
    const ct = response.headers()['content-type'] || '';
    if (ct.startsWith('image/')) {
      try {
        const buffer = await response.buffer();
        capturedImages.push({ url, buffer, idx: capturedImages.length });
      } catch (e) {}
    }
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

console.log(`Captured ${capturedImages.length} images`);

// Deduplicate
const seen = new Set();
const uniqueImages = capturedImages.filter(img => {
  if (seen.has(img.url)) return false;
  seen.add(img.url);
  return true;
});
console.log(`Unique: ${uniqueImages.length}`);

// Now get the text groupings from the page
// Each item caption appears in order alongside images
const pageText = await page.evaluate(() => {
  // Get all visible text content in order
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  const texts = [];
  let node;
  while (node = walker.nextNode()) {
    const t = node.textContent.trim();
    if (t && t.length > 1) texts.push(t);
  }
  return texts;
});

// Filter to only Stone Dice section content
const startIdx = pageText.indexOf('Stone Dice');
const relevantText = startIdx >= 0 ? pageText.slice(startIdx) : pageText;
console.log('\nRelevant text:', relevantText.slice(0, 30));

// Known item names from the page
const knownItems = [
  { text: 'Moon Style (Aquamarine Zircon)', title: 'Moon Style', author: 'Aquamarine Zircon' },
  { text: 'Anubis', title: 'Anubis', author: '' },
  { text: 'Blood Red (Garnet Zircon)', title: 'Blood Red', author: 'Garnet Zircon' },
  { text: 'Black (Raised Obsidian)', title: 'Black', author: 'Raised Obsidian' },
  { text: 'Cat Style (Dichroic Glass)', title: 'Cat Style', author: 'Dichroic Glass' },
  { text: 'Micro dice (Semiprecious stones)', title: 'Micro dice', author: 'Semiprecious stones' },
];

// Manually figure out image grouping by examining the page
// We know: 21 unique images, 6 items
// Let's take a screenshot to analyze the layout
await page.screenshot({ path: 'screenshots/stone-dice-full.png', fullPage: true });
console.log('Screenshot saved');

// The simplest approach: distribute evenly and let user fix
// But let's detect actual grouping from section structure
const sectionAnalysis = await page.evaluate(() => {
  const sections = document.querySelectorAll('section');
  const info = [];
  sections.forEach((s, i) => {
    // Count image-like elements
    const allEls = s.querySelectorAll('*');
    const imgEls = [];
    allEls.forEach(el => {
      if (el.tagName === 'IMG' || el.tagName === 'img') imgEls.push(el.src || '');
    });
    if (imgEls.length > 0) {
      info.push({ sectionIdx: i, imgCount: imgEls.length });
    }
  });
  return info;
});

console.log('\nSections with images:', JSON.stringify(sectionAnalysis));

// Also get the raw HTML to understand the structure
const htmlSnippet = await page.evaluate(() => {
  return document.body.innerHTML.substring(0, 50000);
});
writeFileSync('stone-dice-html.html', htmlSnippet);
console.log('HTML saved (50k chars)');

// Count images per section from the HTML
const imgMatches = htmlSnippet.match(/<img[^>]*sitesv-images[^>]*>/g);
if (imgMatches) console.log(`IMG tags in HTML: ${imgMatches.length}`);

await browser.close();
