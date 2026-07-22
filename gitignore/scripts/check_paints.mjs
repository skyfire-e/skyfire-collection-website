import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = 'https://sites.google.com/view/skyf1re/paints';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

try {
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForNetworkIdle({ idleTime: 5000 });
  await new Promise(r => setTimeout(r, 2000));

  const text = await page.evaluate(() => document.body.innerText);
  const images = await page.evaluate(() => document.querySelectorAll('img[src*="sitesv-images"]').length);
  const allImgs = await page.evaluate(() => document.querySelectorAll('img').length);

  console.log('Page text (first 2000 chars):');
  console.log(text.slice(0, 2000));
  console.log(`\nImages with sitesv-images: ${images}`);
  console.log(`Total images: ${allImgs}`);
} catch (err) {
  console.log('Error:', err.message);
}

await browser.close();
