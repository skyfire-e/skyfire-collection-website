import { readFileSync } from 'fs';

const http = await import('http');
const BASE = 'http://localhost:3000';

const items = [
  { title: 'Dragon', author: '', images: ['metal-dice-1-1.jpg'] },
  { title: 'Dwarven', author: 'Q-workshop', images: ['metal-dice-2-1.jpg'] },
  { title: 'Edge Boss', author: 'EnvyDice', images: ['metal-dice-3-1.jpg'] },
  { title: 'Ancient Dragon Gold', author: 'EasyRoller', images: ['metal-dice-4-1.jpg'] },
  { title: 'Legendary Metals', author: '', images: ['metal-dice-5-1.jpg'] },
  { title: "Assassin's Dice", author: 'DarkElfDice', images: ['metal-dice-6-1.jpg'] },
  { title: 'Anodized Red', author: '', images: ['metal-dice-7-1.jpg'] },
  { title: 'Skeletons Red', author: '', images: ['metal-dice-8-1.jpg'] },
  { title: 'Skeletons White', author: '', images: ['metal-dice-9-1.jpg'] },
  { title: 'Octopus-shaped', author: 'cusdie', images: ['metal-dice-10-1.jpg'] },
  { title: 'Sword and Shield', author: 'cusdie', images: ['metal-dice-11-1.jpg'] },
  { title: 'Spiders Web', author: '', images: ['metal-dice-12-1.jpg'] },
  { title: 'Big d20 Edge Skulls', author: '', images: ['metal-dice-13-1.jpg'] },
  { title: 'Cogs', author: '', images: ['metal-dice-14-1.jpg'] },
  { title: 'Dagger Style', author: 'cusdie', images: ['metal-dice-15-1.jpg'] },
  { title: 'Labyrinth', author: '', images: ['metal-dice-16-1.jpg'] },
  { title: 'Silver Snowflakes', author: '', images: ['metal-dice-17-1.jpg'] },
  { title: 'Edge Skulls', author: '', images: ['metal-dice-18-1.jpg'] },
  { title: 'Dragon Scale', author: 'cusdie', images: ['metal-dice-19-1.jpg'] },
  { title: 'Spiked Cogs', author: 'cusdie', images: ['metal-dice-20-1.jpg'] },
  { title: 'Skulls on edges', author: '', images: ['metal-dice-21-1.jpg'] },
  { title: 'Colorful Framed', author: '', images: ['metal-dice-22-1.jpg'] },
  { title: 'Skeleton-shaped', author: 'cusdie', images: ['metal-dice-23-1.jpg'] },
  { title: '9d6', author: 'CyberDiceGames', images: ['metal-dice-24-1.jpg'] },
  { title: 'Underwater', author: '', images: ['metal-dice-25-1.jpg'] },
  { title: 'Stone Stamps', author: 'cusdie', images: ['metal-dice-26-1.jpg'] },
  { title: 'Elven Ligature', author: 'cusdie', images: ['metal-dice-27-1.jpg'] },
  { title: 'Flowers', author: 'cusdie', images: ['metal-dice-28-1.jpg'] },
  { title: '7d6', author: 'CyberDiceGames', images: ['metal-dice-29-1.jpg'] },
  { title: '3d6 18mm', author: 'Alchemy Gothic', images: ['metal-dice-30-1.jpg'] },
];

// Login
const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
const loginReq = http.request(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    console.log(`Logged in, ${items.length} items to import\n`);
    postItem(0, cookies);
  });
});
loginReq.write(loginData);
loginReq.end();

function postItem(idx, cookies) {
  if (idx >= items.length) {
    console.log('\nAll items imported!');
    return;
  }

  const item = items[idx];
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const parts = [];

  const fields = [
    { name: 'section', value: 'dice' },
    { name: 'category', value: 'metal-dice' },
    { name: 'title', value: item.title },
    { name: 'author', value: item.author },
  ];

  for (const f of fields) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`
    ));
  }

  for (const filename of item.images) {
    const fpath = `uploads/${filename}`;
    const imgData = readFileSync(fpath);
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`
    ));
    parts.push(imgData);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const totalBuffer = Buffer.concat(parts);

  const req = http.request(`${BASE}/api/items`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalBuffer.length,
      'Cookie': cookies,
    },
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const result = JSON.parse(data);
      console.log(`[${idx+1}/${items.length}] ${item.title}${item.author ? ' (' + item.author + ')' : ''} \u2192 ID ${result.id}`);
      postItem(idx + 1, cookies);
    });
  });
  req.write(totalBuffer);
  req.end();
}
