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
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 3000 });

await page.screenshot({ path: 'screenshots/stone-dice.png', fullPage: true });

const images = await page.evaluate(() => {
  const imgs = document.querySelectorAll('img[src*="googleusercontent"]');
  return Array.from(imgs).map(img => {
    const parent = img.closest('div') || img.parentElement;
    const section = parent?.closest('section') || parent?.closest('[role="main"]');
    const allText = section ? Array.from(section.querySelectorAll('*')).filter(el => el.children.length === 0).map(el => el.textContent.trim()).filter(Boolean) : [];
    return {
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height,
      nearbyText: allText.slice(0, 10),
      parentTag: parent?.tagName,
      parentClass: parent?.className?.slice(0, 200),
    };
  });
});

const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 50000));

writeFileSync('explore_stone.json', JSON.stringify({ images, htmlSample: bodyHTML }, null, 2));
console.log(`Found ${images.length} images on stone-dice page`);
console.log('Screenshot saved');

await browser.close();
