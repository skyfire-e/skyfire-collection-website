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

// Intercept all XHR/fetch requests to find API calls
const apiCalls = [];
page.on('request', req => {
  const url = req.url();
  if (url.includes('googleapis.com') || url.includes('google.com/_')) {
    apiCalls.push({ url: url.slice(0, 200), method: req.method(), type: req.resourceType() });
  }
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForNetworkIdle({ idleTime: 5000 });

console.log('Google API calls made:');
apiCalls.forEach(c => console.log(`  ${c.method} ${c.url}`));

// Now check the globals object thoroughly
const siteData = await page.evaluate(() => {
  const globals = {};
  
  // Check the _docs_flag_initialData
  if (window._docs_flag_initialData) {
    globals.initialData = Object.keys(window._docs_flag_initialData).slice(0, 30);
  }
  
  // Check all window globals
  for (const key of Object.getOwnPropertyNames(window)) {
    try {
      const val = window[key];
      if (val && typeof val === 'object') {
        const str = JSON.stringify(val);
        if (str.includes('sitesv-images-rt')) {
          globals[key + ' (has images)'] = str.slice(0, 500);
        }
      }
    } catch(e) {}
  }
  
  return globals;
});

console.log('\nSite data with images:');
Object.entries(siteData).forEach(([k, v]) => {
  if (typeof v === 'string' && v.length > 100) {
    console.log(`\n${k}:`);
    console.log(v.slice(0, 800));
  } else {
    console.log(`\n${k}: ${JSON.stringify(v).slice(0, 500)}`);
  }
});

await browser.close();
