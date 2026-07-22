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

// Try to extract Google Sites internal data
const appData = await page.evaluate(() => {
  // Look for common Google Sites global data
  const globals = {};
  
  // Check for __INITIAL_STATE__ or similar
  if (window.__INITIAL_STATE__) globals.INITIAL_STATE = true;
  if (window.__INITIAL_DATA__) globals.INITIAL_DATA = true;
  
  // Look for Google Sites app data
  for (const key of Object.keys(window)) {
    if (key.toLowerCase().includes('sites') || key.toLowerCase().includes('app')) {
      globals[key] = typeof window[key];
    }
  }
  
  return globals;
});

console.log('Global data found:');
console.log(JSON.stringify(appData, null, 2));

// Also try to find the widget model data  
const widgetData = await page.evaluate(() => {
  // Google Sites uses specific CSS classes and data attributes
  // Look for elements with carousel-like behavior
  
  const results = [];
  
  // Find all section elements with images
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    // Check for w5 (Google Sites widget)  or similar
    const classes = Array.from(el.classList);
    if (classes.some(c => c.startsWith('w5') || c.startsWith('W5'))) {
      results.push({
        tag: el.tagName,
        classes: classes.slice(0, 5),
        id: el.id,
      });
    }
  }
  
  return results;
});

console.log('\nGoogle Sites widget elements:');
widgetData.forEach(w => console.log(`  ${w.tag}.${w.classes.join('.')}`));

// Let's try another approach - use CDP to get the full layout tree
const layoutTree = await page.evaluate(() => {
  // Get all elements that have visual size/position
  const rects = [];
  const all = document.querySelectorAll('*');
  for (const el of all) {
    if (!el.children.length && el.textContent.trim() && el.offsetHeight > 0) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        rects.push({
          tag: el.tagName,
          text: el.textContent.trim().slice(0, 50),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
  }
  return rects.slice(0, 100); // limit
});

console.log('\nVisible text elements (first 20):');
const stoneDiceTexts = layoutTree
  .filter(r => r.text.toLowerCase().includes('stone') || r.text.toLowerCase().includes('moon') || r.text.toLowerCase().includes('anubis') || r.text.toLowerCase().includes('blood') || r.text.toLowerCase().includes('black') || r.text.toLowerCase().includes('cat') || r.text.toLowerCase().includes('micro'))
  .slice(0, 20);

stoneDiceTexts.forEach(t => {
  console.log(`  "${t.text}" at (${t.x},${t.y}) size ${t.w}x${t.h}`);
});

await browser.close();
