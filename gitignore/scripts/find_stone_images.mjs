import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/dice/stone-dice';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

// Intercept ALL image responses to find the actual image URLs
const imageUrls = new Set();
page.on('response', async (response) => {
  const ct = response.headers()['content-type'] || '';
  if (ct.startsWith('image/') && response.status() === 200) {
    imageUrls.add(response.url());
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 3000));

console.log('=== ALL IMAGE URLS ===');
let i = 0;
for (const url of imageUrls) {
  console.log(`${++i}: ${url.slice(0, 250)}`);
}

// Also get ALL img elements from the DOM
const domImages = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img');
  return Array.from(imgs).map(img => ({
    src: img.src?.slice(0, 300),
    alt: img.alt,
    width: img.naturalWidth,
    height: img.naturalHeight,
    className: img.className?.slice(0, 100),
  }));
});

console.log(`\n=== DOM IMAGES (${domImages.length}) ===`);
domImages.forEach((img, i) => {
  if (img.naturalWidth > 50) {
    console.log(`${i}: src=${img.src?.slice(0, 150)} w=${img.width} h=${img.height}`);
  }
});

// Screenshot to see what's there
await page.screenshot({ path: 'screenshots/stone-dice.png', fullPage: true });
console.log('\nScreenshot saved');

await browser.close();
