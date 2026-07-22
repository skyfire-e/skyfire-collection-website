import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const HOME_URL = 'https://sites.google.com/view/skyf1re/home';

const browser = await puppeteer.launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(HOME_URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 3000 });

// Get ALL unique page links from navigation
const allLinks = await page.evaluate(() => {
  const links = document.querySelectorAll('a');
  const siteLinks = new Set();
  links.forEach(a => {
    const href = a.href;
    if (href && href.startsWith('https://sites.google.com/view/skyf1re/') && !href.includes('#') && !href.includes('?') && !href.endsWith('/home')) {
      siteLinks.add(href);
    }
  });
  return Array.from(siteLinks);
});

console.log(`Found ${allLinks.length} unique subpages:`);
allLinks.forEach(l => console.log(`  ${l}`));

// Also add the homepage and section index pages
const allPages = [
  HOME_URL,
  'https://sites.google.com/view/skyf1re/dice',
  'https://sites.google.com/view/skyf1re/miniatures',
  'https://sites.google.com/view/skyf1re/paints',
  'https://sites.google.com/view/skyf1re/painting-recipes',
  ...allLinks,
];

// Remove duplicates
const uniquePages = [...new Set(allPages)];
console.log(`\nTotal unique pages to check: ${uniquePages.length}`);

// Check each page for image count
const results = {};
for (const url of uniquePages) {
  console.log(`\nChecking ${url}...`);
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 2000 });
    await new Promise(r => setTimeout(r, 1000));

    const count = await page.evaluate(() => {
      return document.querySelectorAll('img[src*="sitesv-images"]').length;
    });

    results[url] = { imageCount: count };
    console.log(`  -> ${count} images`);
  } catch (err) {
    results[url] = { error: err.message };
    console.log(`  -> ERROR: ${err.message}`);
  }
}

writeFileSync('page_image_counts.json', JSON.stringify(results, null, 2));
console.log('\nDone. Results saved to page_image_counts.json');

await browser.close();
