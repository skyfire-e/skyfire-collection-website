import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://sites.google.com/view/skyf1re/home';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

await page.waitForNetworkIdle({ idleTime: 3000 });

await page.screenshot({ path: 'screenshots/homepage.png', fullPage: true });

const pageTitle = await page.title();
const bodyText = await page.evaluate(() => document.body.innerText);
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a')).map(a => ({
    href: a.href,
    text: a.innerText.trim().slice(0, 100),
  }))
);
const images = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img')).map(img => ({
    src: img.src,
    alt: img.alt,
    width: img.width,
    height: img.height,
    className: img.className,
  }))
);

writeFileSync('explore_output.json', JSON.stringify({
  title: pageTitle,
  bodyText: bodyText.slice(0, 5000),
  links: links.slice(0, 100),
  images: images.slice(0, 50),
}, null, 2));

console.log('Screenshot saved to screenshots/homepage.png');
console.log('Explore output saved to explore_output.json');

await browser.close();
