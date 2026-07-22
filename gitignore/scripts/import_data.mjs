import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

// Read scraped data
const scraped = JSON.parse(readFileSync('scrape_progress.json', 'utf8'));
const entries = scraped.entries;

// Map scraped category names to category IDs
const CATEGORY_MAP = {
  'Metal Dice': 'metal-dice',
  'Resin Dice': 'resin-dice',
  'Acrylic Dice': 'acrylic-dice',
  'Wooden Dice': 'wooden-dice',
  'Acrylic Figurines': 'acrylic-figurines',
  'Metal Figurines': 'metal-figurines',
  'Citadel Skaven': 'citadel-skaven',
  'Old Citadel Skaven': 'old-citadel-skaven',
  'Blood Bowl Skaven': 'blood-bowl-skaven',
  'Forgeworld Skaven': 'forgeworld-skaven',
  'Punga Miniatures Skaven': 'punga-miniatures-skaven',
  '3d Prints Skaven': '3d-prints-skaven',
  'Citadel Orks': 'citadel-orks',
  'Forgeworld Orks': 'forgeworld-orks',
  'Old Citadel Orks (oldhammer)': 'old-citadel-orks-oldhammer',
  'Artel W': 'artel-w',
  'Kromlech': 'kromlech',
  'Various Studios': 'various-studios',
  '3d Printed Orks': '3d-printed-orks',
  'Gloomspite Gitz (AoS)': 'gloomspite-gitz-aos',
  'Adepta Sororitas (40k)': 'adepta-sororitas-40k',
  'Orruk Warclans (AoS)': 'orruk-warclans-aos',
  'Chaos Daemons': 'chaos-daemons',
  'Soulblight Gravelords (AoS)': 'soulblight-gravelords-aos',
  'Astra Militarum (40k)': 'astra-militarum-40k',
  'Officio Assassinorum': 'officio-assassinorum',
  'Ogor Mawtribes': 'ogor-mawtribes',
  'Maggotkin of Nurgle': 'maggotkin-of-nurgle',
  'Kharadron Overlords': 'kharadron-overlords',
  'Empire': 'empire',
  'High Elves': 'high-elves',
  'Stormcast Eternals': 'stormcast-eternals',
  'Terrain': 'terrain',
  'Other (miniatures)': 'other',
  'Pictured': 'pictured',
  'Text': 'text',
};

// Clean up titles and authors
function cleanTitle(title) {
  // Remove leading numbers like "2) " or "35) "
  let cleaned = title.replace(/^\d+\)\s*/, '');
  // Remove leading just numbers
  cleaned = cleaned.trim();
  if (/^\d+$/.test(cleaned)) {
    return ''; // mark for fallback
  }
  return cleaned;
}

function cleanAuthor(author) {
  let a = author.trim();
  // Fix common issues
  if (a === 'hollo') return '(hollow)';
  if (a === 'hollow') return '(hollow)';
  if (a === 'by cusdie') return 'cusdie';
  if (a === 'by Q-workshop') return 'Q-workshop';
  if (a.startsWith('by ')) return a.substring(3);
  return a;
}

// Build items
const items = [];
const seenImages = new Set();

for (const entry of entries) {
  // Check if image exists and has content
  const localPath = join('uploads_scraped', entry.localFile);
  let imagePath = '/images/default.svg';
  if (existsSync(localPath) && statSync(localPath).size > 500) {
    imagePath = `/uploads/${entry.localFile}`;
  }

  // Determine section and category ID
  let section = entry.section;
  let categoryId = CATEGORY_MAP[entry.category];
  
  if (!categoryId) {
    categoryId = entry.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // Handle painting-recipes section items
  if (section === 'painting-recipes') {
    continue; // Skip painting recipes for now
  }

  // Clean up title
  let title = cleanTitle(entry.title);
  if (!title) {
    // Use category name + number as fallback
    title = `${entry.category} Item`;
  }

  // Clean up author
  const author = cleanAuthor(entry.author);

  // Skip items where title is just numbers
  if (/^\d+$/.test(title)) continue;

  items.push({
    id: Date.now() + items.length,
    section,
    category: categoryId,
    title,
    author,
    price: '',
    image: imagePath,
    createdAt: new Date().toISOString(),
  });
}

console.log(`Generated ${items.length} items`);

// Update categories.json with all new subcategories
const categories = {
  dice: {
    label: 'Dice',
    subcategories: [
      { id: 'stone-dice', label: 'Stone Dice' },
      { id: 'metal-dice', label: 'Metal Dice' },
      { id: 'resin-dice', label: 'Resin Dice' },
      { id: 'acrylic-dice', label: 'Acrylic Dice' },
      { id: 'wooden-dice', label: 'Wooden Dice' },
      { id: 'acrylic-figurines', label: 'Acrylic Figurines' },
      { id: 'metal-figurines', label: 'Metal Figurines' },
    ],
  },
  miniatures: {
    label: 'Miniatures',
    subcategories: [
      { id: 'citadel-skaven', label: 'Citadel Skaven' },
      { id: 'old-citadel-skaven', label: 'Old Citadel Skaven' },
      { id: 'blood-bowl-skaven', label: 'Blood Bowl Skaven' },
      { id: 'forgeworld-skaven', label: 'Forgeworld Skaven' },
      { id: 'punga-miniatures-skaven', label: 'Punga Miniatures Skaven' },
      { id: '3d-prints-skaven', label: '3d Prints Skaven' },
      { id: 'citadel-orks', label: 'Citadel Orks' },
      { id: 'forgeworld-orks', label: 'Forgeworld Orks' },
      { id: 'old-citadel-orks-oldhammer', label: 'Old Citadel Orks (oldhammer)' },
      { id: 'artel-w', label: 'Artel W' },
      { id: 'kromlech', label: 'Kromlech' },
      { id: 'various-studios', label: 'Various Studios' },
      { id: '3d-printed-orks', label: '3d Printed Orks' },
      { id: 'gloomspite-gitz-aos', label: 'Gloomspite Gitz (AoS)' },
      { id: 'adepta-sororitas-40k', label: 'Adepta Sororitas (40k)' },
      { id: 'orruk-warclans-aos', label: 'Orruk Warclans (AoS)' },
      { id: 'chaos-daemons', label: 'Chaos Daemons' },
      { id: 'soulblight-gravelords-aos', label: 'Soulblight Gravelords (AoS)' },
      { id: 'astra-militarum-40k', label: 'Astra Militarum (40k)' },
      { id: 'officio-assassinorum', label: 'Officio Assassinorum' },
      { id: 'ogor-mawtribes', label: 'Ogor Mawtribes' },
      { id: 'maggotkin-of-nurgle', label: 'Maggotkin of Nurgle' },
      { id: 'kharadron-overlords', label: 'Kharadron Overlords' },
      { id: 'empire', label: 'Empire' },
      { id: 'high-elves', label: 'High Elves' },
      { id: 'stormcast-eternals', label: 'Stormcast Eternals' },
      { id: 'terrain', label: 'Terrain' },
      { id: 'other', label: 'Other' },
    ],
  },
};

writeFileSync('data/categories.json', JSON.stringify(categories, null, 2));
console.log('Updated categories.json');

writeFileSync('data/items.json', JSON.stringify(items, null, 2));
console.log('Updated items.json');

// Copy images to uploads/ directory
mkdirSync('uploads', { recursive: true });
let copied = 0;
for (const item of items) {
  if (item.image && item.image.startsWith('/uploads/')) {
    const filename = item.image.replace('/uploads/', '');
    const src = join('uploads_scraped', filename);
    const dest = join('uploads', filename);
    if (existsSync(src)) {
      try {
        copyFileSync(src, dest);
        copied++;
      } catch (err) {
        console.log(`Failed to copy ${src}: ${err.message}`);
      }
    }
  }
}

console.log(`Copied ${copied} images to uploads/`);
console.log('Import complete!');
