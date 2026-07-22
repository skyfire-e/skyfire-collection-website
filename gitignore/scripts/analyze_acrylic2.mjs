import { readFileSync } from 'fs';
const html = readFileSync('acrylic-page.html', 'utf8');

// Get all C9DxTc spans with their parent context
const regex = /<span[^>]*class="[^"]*C9DxTc[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
let match;
const spans = [];
while ((match = regex.exec(html)) !== null) {
  const txt = match[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  if (txt) spans.push(txt);
}

console.log('All C9DxTc text nodes:');
spans.forEach((s, i) => console.log((i+1) + ': "' + s + '"'));
