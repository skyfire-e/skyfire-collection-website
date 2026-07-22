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
await page.waitForNetworkIdle({ idleTime: 5000 });
await new Promise(r => setTimeout(r, 2000));

// Get all script tags content
const scripts = await page.evaluate(() => {
  const results = [];
  const scripts = document.querySelectorAll('script');
  scripts.forEach(s => {
    const src = s.src || '';
    const id = s.id || '';
    const type = s.type || '';
    const content = s.textContent?.slice(0, 500) || '';
    results.push({
      src: src.slice(0, 100),
      id,
      type,
      contentLength: s.textContent?.length || 0,
      contentPreview: content.slice(0, 200),
      hasSiteData: content.includes('siteData') || content.includes('entity') || content.includes('siteName'),
    });
  });
  return results;
});

console.log('Scripts with site data:');
scripts.filter(s => s.hasSiteData || s.contentLength > 10000).forEach(s => {
  console.log(`  src=${s.src}, id=${s.id}, len=${s.contentLength}`);
  console.log(`  preview: ${s.contentPreview}`);
  console.log('');
});

// Also look for JSON data in the page's global objects
const globals = await page.evaluate(() => {
  const found = {};
  for (const key of Object.getOwnPropertyNames(window)) {
    try {
      const val = window[key];
      if (val && typeof val === 'object' && !val.nodeType) {
        const str = JSON.stringify(val).slice(0, 200);
        if (str.includes('sitesv-images') || str.includes('stone') || str.includes('dice')) {
          found[key] = str.slice(0, 300);
        }
      }
    } catch(e) {}
  }
  return found;
});

console.log('\nGlobal objects with relevant data:');
Object.entries(globals).forEach(([k, v]) => {
  console.log(`  ${k}: ${v}`);
});

await browser.close();
