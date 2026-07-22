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

const html = await page.evaluate(() => {
  const main = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
  return main.innerHTML.slice(0, 100000);
});

writeFileSync('metal-dice-html.html', html);
console.log('Saved HTML, length:', html.length);

// Also get all visible text on the page
const allText = await page.evaluate(() => document.body.innerText);
writeFileSync('metal-dice-text.txt', allText);
console.log('Visible text length:', allText.length);
console.log('First 2000 chars of text:');
console.log(allText.slice(0, 2000));

await browser.close();
