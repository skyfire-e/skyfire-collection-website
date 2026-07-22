import { readFileSync } from 'fs';
const html = readFileSync('acrylic-page.html', 'utf8');

// Find all heading tags
const hTags = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi);
console.log('Headings found:', hTags ? hTags.length : 0);
if (hTags) {
  hTags.forEach((h, i) => {
    const tag = h.match(/<h([1-6])/i);
    const clean = h.replace(/<[^>]+>/g, '').trim();
    if (clean) console.log((i+1) + ': h' + tag[1] + ' => ' + clean.substring(0, 100));
  });
}

// Find all sections
const sections = html.match(/<section[\s\S]*?<\/section>/gi);
console.log('\nSections:', sections ? sections.length : 0);

// Look at section classes
if (sections) {
  sections.forEach((s, i) => {
    const cls = s.match(/class="([^"]*)"/);
    const h2 = s.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
    const p = s.match(/<p[^>]*>[\s\S]*?<\/p>/i);
    const img = s.match(/<img[^>]*src="([^"]*)"/);
    console.log(`Section ${i+1}: class=${cls ? cls[1] : 'none'}, h2=${h2 ? h2[0].replace(/<[^>]+>/g,'').trim().substring(0,50) : 'none'}`);
  });
}

// Look for C9DxTc spans
const c9 = html.match(/C9DxTc[^<]*<[^>]*>([^<]*)/g);
console.log('\nC9DxTc spans:', c9 ? c9.length : 0);
if (c9) {
  c9.slice(0, 30).forEach((c, i) => {
    const txt = c.replace(/<[^>]+>/g, '').trim();
    if (txt) console.log(`  ${i+1}: "${txt}"`);
  });
}
