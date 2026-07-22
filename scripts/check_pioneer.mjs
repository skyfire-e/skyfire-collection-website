import { readFileSync } from 'fs';
const html = readFileSync('metal-fig-page.html', 'utf8');

// Find "Pioneer" in the HTML
const idx = html.indexOf('Pioneer');
if (idx >= 0) {
  const context = html.substring(Math.max(0, idx - 200), idx + 300);
  console.log('Found "Pioneer" at index', idx);
  console.log('Context:');
  console.log(context);
}
