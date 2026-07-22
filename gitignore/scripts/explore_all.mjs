import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pagesToCheck = [
  'https://sites.google.com/view/skyf1re/dice',
  'https://sites.google.com/view/skyf1re/dice/stone-dice',
  'https://sites.google.com/view/skyf1re/dice/metal-dice',
  'https://sites.google.com/view/skyf1re/dice/resin-dice',
  'https://sites.google.com/view/skyf1re/miniatures',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/citadel-skaven',
  'https://sites.google.com/view/skyf1re/miniatures/warhammer/skaven/old-citadel-skaven',
  'https://sites.google.com/view/skyf1re/paints',
  'https://sites.google.com/view/skyf1re/painting-recipes',
  'https://sites.google.com/view/skyf1re/painting-recipes/pictured',
];

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const results = {};

for (const url of pagesToCheck) {
  console.log(`Checking ${url}...`);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 2000 });

    const data = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src*="googleusercontent"]');
      const allImgs = document.querySelectorAll('img');
      const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
        href: a.href,
        text: a.innerText.trim().slice(0, 100),
      })).filter(l => l.href && !l.href.startsWith('javascript'));
      const bodyText = document.body.innerText.slice(0, 3000);
      return {
        imageCount: imgs.length,
        totalImgCount: allImgs.length,
        googleImages: Array.from(imgs).map(img => ({
          src: img.src.slice(0, 200),
          alt: img.alt,
        })),
        links: allLinks.slice(0, 30),
        bodyTextSnippet: bodyText.slice(0, 1000),
      };
    });

    results[url] = data;
    console.log(`  -> ${data.imageCount} google images, ${data.totalImgCount} total images`);
    await page.close();
  } catch (err) {
    results[url] = { error: err.message };
    console.log(`  -> ERROR: ${err.message}`);
  }
}

writeFileSync('explore_all_pages.json', JSON.stringify(results, null, 2));
console.log('\nDone. Results saved to explore_all_pages.json');

await browser.close();
