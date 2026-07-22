import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pages = [
  'https://sites.google.com/view/skyf1re/dice/metal-dice',
  'https://sites.google.com/view/skyf1re/dice/resin-dice',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/citadel-skaven',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/old-citadel-skaven',
  'https://sites.google.com/view/skyf1re/painting-recipes/pictured',
];

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const results = {};

for (const url of pages) {
  console.log(`Checking ${url}...`);
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForNetworkIdle({ idleTime: 3000 });

  const data = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => ({
      src: img.src.slice(0, 300),
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight,
      className: img.className?.slice(0, 100),
      parentTag: img.parentElement?.tagName,
      parentClass: img.parentElement?.className?.slice(0, 100),
      grandparentTag: img.parentElement?.parentElement?.tagName,
      grandparentClass: img.parentElement?.parentElement?.className?.slice(0, 100),
    }));
  });

  results[url] = { count: data.length, images: data };
  console.log(`  -> ${data.length} images`);
  if (data.length > 0) {
    console.log(`  -> First img src: ${data[0].src.slice(0, 200)}`);
  }

  // Also take a screenshot
  await page.screenshot({ path: `screenshots/${url.split('/').pop() || 'index'}.png`, fullPage: false });
  await page.close();
}

writeFileSync('explore_images_detail.json', JSON.stringify(results, null, 2));
console.log('\nDone.');

await browser.close();
