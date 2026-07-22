import { readFileSync } from 'fs';

const http = await import('http');

const BASE = 'http://localhost:3000';

const items = [
  { title: 'Moon Style', author: 'Aquamarine Zircon', images: [1, 2, 3] },
  { title: 'Anubis', author: '', images: [4, 5, 6] },
  { title: 'Blood Red', author: 'Garnet Zircon', images: [7, 8, 9, 10] },
  { title: 'Black', author: 'Raised Obsidian', images: [11, 12, 13, 14] },
  { title: 'Cat Style', author: 'Dichroic Glass', images: [15, 16, 17] },
  { title: 'Micro dice', author: 'Semiprecious stones', images: [18, 19, 20] },
];

const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });

const loginReq = http.request(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const cookies = res.headers['set-cookie'];
    console.log('Logged in\n');
    postItem(0, cookies);
  });
});
loginReq.write(loginData);
loginReq.end();

function postItem(itemIdx, cookies) {
  if (itemIdx >= items.length) {
    console.log('\nAll items imported!');
    return;
  }

  const item = items[itemIdx];
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);

  const fields = [
    { name: 'section', value: 'dice' },
    { name: 'category', value: 'stone-dice' },
    { name: 'title', value: item.title },
    { name: 'author', value: item.author },
  ];

  const parts = [];
  for (const f of fields) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}\r\n`
    ));
  }

  for (const imgNum of item.images) {
    const filePath = `uploads/stone-dice-${imgNum}.jpg`;
    const fileData = readFileSync(filePath);
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="stone-dice-${imgNum}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    ));
    parts.push(fileData);
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
      const imgCount = item.images.length;
      console.log(`[${itemIdx+1}/${items.length}] ${item.title}${item.author ? ' (' + item.author + ')' : ''} - ${imgCount} image(s)${result.images ? ' → ' + result.images.length + ' stored' : ''}`);
      postItem(itemIdx + 1, cookies);
    });
  });
  req.write(totalBuffer);
  req.end();
}
