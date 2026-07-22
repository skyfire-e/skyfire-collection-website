import { readFileSync, writeFileSync, existsSync } from 'fs';

const mapping = JSON.parse(readFileSync('wooden-dice-mapping.json', 'utf8'));
const itemsPath = 'data/items.json';
const items = JSON.parse(readFileSync(itemsPath, 'utf8'));

console.log(`Importing ${mapping.length} wooden dice items...`);

mapping.forEach((entry, i) => {
  const newItem = {
    id: Date.now() + i,
    section: 'dice',
    category: 'wooden-dice',
    title: entry.title,
    author: entry.author,
    price: '',
    image: entry.images.length > 0 ? '/uploads/' + entry.images[0] : '/images/default.svg',
    images: entry.images.map(f => '/uploads/' + f),
    createdAt: new Date().toISOString()
  };
  
  entry.images.forEach(f => {
    const fullPath = 'uploads/' + f;
    if (!existsSync(fullPath)) console.log('  WARNING: missing ' + fullPath);
  });
  
  items.push(newItem);
  console.log(`  ${i+1}. "${entry.title}" author="${entry.author}"`);
});

writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf8');
console.log(`\nDone. Total items: ${items.length}`);
