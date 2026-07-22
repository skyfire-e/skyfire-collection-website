import { readFileSync, writeFileSync, existsSync } from 'fs';

const mapping = JSON.parse(readFileSync('acrylic-dice-mapping.json', 'utf8'));
const itemsPath = 'data/items.json';
const items = JSON.parse(readFileSync(itemsPath, 'utf8'));

console.log(`Importing ${mapping.length} acrylic dice items...`);
console.log(`Existing items: ${items.length}`);

let imported = 0;
mapping.forEach((entry, i) => {
  const newItem = {
    id: Date.now() + i,
    section: 'dice',
    category: 'acrylic-dice',
    title: entry.title,
    author: entry.author,
    price: '',
    image: entry.images.length > 0 ? '/uploads/' + entry.images[0] : '/images/default.svg',
    images: entry.images.map(f => '/uploads/' + f),
    createdAt: new Date().toISOString()
  };
  
  // Verify image files exist
  entry.images.forEach(f => {
    const fullPath = 'uploads/' + f;
    if (!existsSync(fullPath)) {
      console.log(`  WARNING: missing ${fullPath}`);
    }
  });
  
  items.push(newItem);
  imported++;
  console.log(`  ${i+1}. "${entry.title}" author="${entry.author}" images=${entry.images.length}`);
});

writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf8');
console.log(`\nDone. Imported ${imported} items. Total items: ${items.length}`);
