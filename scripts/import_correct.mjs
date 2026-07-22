import { readFileSync } from 'fs';

const http = await import('http');
const BASE = 'http://localhost:3000';

const items = [
  { title: 'Moon Style', author: 'Aquamarine Zircon', images: ['stone-dice-1-1.jpg', 'stone-dice-1-2.jpg', 'stone-dice-1-3.jpg'] },
  { title: 'Anubis', author: '', images: ['stone-dice-2-1.jpg', 'stone-dice-2-2.jpg', 'stone-dice-2-3.jpg'] },
  { title: 'Blood Red', author: 'Garnet Zircon', images: ['stone-dice-3-1.jpg', 'stone-dice-3-2.jpg', 'stone-dice-3-3.jpg'] },
  { title: 'Black', author: 'Raised Obsidian', images: ['stone-dice-4-1.jpg', 'stone-dice-4-2.jpg', 'stone-dice-4-3.jpg'] },
  { title: 'Cat Style', author: 'Dichroic Glass', images: ['stone-dice-5-1.jpg', 'stone-dice-5-2.jpg', 'stone-dice-5-3.jpg', 'stone-dice-5-4.jpg'] },
  { title: 'Micro dice', author: 'Semiprecious stones', images: ['stone-dice-6-1.jpg', 'stone-dice-6-2.jpg', 'stone-dice-6-3.jpg'] },
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
    { name: 'category', value: 'stone-dice' },
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
      console.log(`[${idx+1}/${items.length}] ${item.title}${item.author ? ' (' + item.author + ')' : ''} - ${item.images.length} images → ID ${result.id}`);
      postItem(idx + 1, cookies);
    });
  });
  req.write(totalBuffer);
  req.end();
}
