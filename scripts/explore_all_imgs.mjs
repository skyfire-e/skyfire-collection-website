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

// Intercept and log image requests
page.on('response', resp => {
  if (resp.url().includes('sitesv-images')) {
    console.log('IMAGE REQUEST:', resp.url().slice(0, 150), resp.status());
  }
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForNetworkIdle({ idleTime: 5000 });

// Take a screenshot to see what's rendered
await page.screenshot({ path: 'screenshots/metal-dice.png', fullPage: false });

// Try ALL images with any src
const data = await page.evaluate(() => {
  const allImgs = document.querySelectorAll('img');
  return Array.from(allImgs).map((img, i) => ({
    idx: i,
    src: img.src?.slice(0, 300),
    alt: img.alt,
    width: img.width,
    height: img.height,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    complete: img.complete,
    className: img.className,
    rect: (() => {
      const r = img.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    })(),
    visible: img.offsetWidth > 0 && img.offsetHeight > 0 && img.getBoundingClientRect().width > 0,
  }));
});

// Also dump page text
const pageText = await page.evaluate(() => document.body.innerText.slice(0, 5000));

writeFileSync('explore_all_imgs.json', JSON.stringify({ images: data, text: pageText }, null, 2));
console.log(`Found ${data.length} total images`);
console.log('Images with src:');
data.filter(d => d.src).forEach(d => console.log(`  [${d.idx}] src=${d.src.slice(0, 150)} visible=${d.visible} w=${d.naturalWidth} h=${d.naturalHeight}`));
if (data.length === 0) console.log('NO images found at all');

await browser.close();
