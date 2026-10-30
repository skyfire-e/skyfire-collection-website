/**
 * Original, photo/reference-based wheel meshes. Front face is +Z; metres.
 * GT Neo: SIMAGIC product photos. Savu Pro: Simucube package drawing (SC3).
 * The Savu mesh is a preview, not a downloaded manufacturer CAD model.
 */
export function createWheel(THREE, variant = 'gt-neo') {
  if (!['gt-neo', 'neo-x', 'savu-pro'].includes(variant)) throw new Error(`Unknown wheel variant: ${variant}`);
  const savu = variant === 'savu-pro';
  const group = new THREE.Group();
  group.name = variant === 'neo-x' ? 'Simagic NEO X-330R' : savu ? 'Simucube Savu Pro preview' : 'Simagic GT Neo';
  group.userData.variant = variant;
  const mat = (color, metalness = 0.1, roughness = 0.58) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const rubber = mat(0x151719, 0.02, 0.91);
  const black = mat(0x1d2023, 0.32, 0.43);
  const silver = mat(0x8c949b, 0.78, 0.26);
  const edge = mat(0x3a3e43, 0.55, 0.39);
  const rubberCanvas = document.createElement('canvas');
  rubberCanvas.width = rubberCanvas.height = 128;
  const rc = rubberCanvas.getContext('2d');
  rc.fillStyle = '#909090';
  rc.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2)
    for (let x = 0; x < 128; x += 2) {
      const v = 110 + ((x * 17 + y * 37) % 70);
      rc.fillStyle = `rgb(${v},${v},${v})`;
      rc.fillRect(x, y, 1, 1);
    }
  rubber.bumpMap = new THREE.CanvasTexture(rubberCanvas);
  rubber.bumpMap.wrapS = rubber.bumpMap.wrapT = THREE.RepeatWrapping;
  rubber.bumpMap.repeat.set(4, 3);
  rubber.bumpScale = 0.00045;
  function add(geometry, material, x = 0, y = 0, z = 0, parent = group) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function shape(points) {
    const s = new THREE.Shape();
    s.moveTo(...points[0]);
    for (const p of points.slice(1)) s.lineTo(...p);
    s.closePath();
    return s;
  }
  function plate(points, depth, material, z = 0, bevel = 0.002) {
    const g = new THREE.ExtrudeGeometry(shape(points), {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 10
    });
    g.translate(0, 0, -depth / 2);
    const uv = g.attributes.uv,
      pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 0.3 + 0.5, pos.getY(i) / 0.18 + 0.5);
    return add(g, material, 0, 0, z);
  }
  function disk(radius, depth, material, x, y, z, segments = 24) {
    const m = add(new THREE.CylinderGeometry(radius, radius, depth, segments), material, x, y, z);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(radius, tube, material, x, y, z) {
    return add(new THREE.TorusGeometry(radius, tube, 6, 24), material, x, y, z);
  }
  function caption(text, w, h, x, y, z, fg = '#e7e9eb', bg = null) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 128);
    }
    ctx.fillStyle = fg;
    ctx.font = '600 74px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 66, 490);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return add(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.65, depthWrite: false }),
      x,
      y,
      z
    );
  }
  function screw(x, y, z) {
    disk(0.0025, 0.0015, silver, x, y, z, 12);
    const m = add(new THREE.BoxGeometry(0.0032, 0.00065, 0.0003), black, x, y, z + 0.0009);
    m.rotation.z = 0.6;
  }
  function grip(points) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const vertices = [],
      normals = [],
      uvs = [],
      indices = [];
    const segments = 64,
      rings = 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments,
        p = curve.getPoint(t),
        tan = curve.getTangent(t);
      const nx = -tan.y,
        ny = tan.x;
      const r = 0.0165 + 0.0032 * Math.sin(Math.PI * t) + 0.0013 * Math.sin(Math.PI * t * 4);
      for (let j = 0; j <= rings; j++) {
        const a = (j / rings) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a);
        vertices.push(p.x + nx * r * c, p.y + ny * r * c, p.z + r * 1.08 * s);
        normals.push(nx * c, ny * c, s);
        uvs.push(j / rings, t);
        if (i < segments && j < rings) {
          const k = i * (rings + 1) + j;
          indices.push(k, k + rings + 1, k + 1, k + 1, k + rings + 1, k + rings + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return add(g, rubber);
  }
  if (variant === 'neo-x') {
    // NEO X-330R: sculpted leather rim in front of the compact forged-carbon hub.
    // Reference: simagic.com/products/simagic-neo-x-series-steering-wheels (330R).
    const leather = mat(0x121315, 0.02, 0.66);
    leather.bumpMap = rubber.bumpMap.clone();
    leather.bumpMap.repeat.set(16, 2);
    leather.bumpScale = 0.00025;
    const redLeather = mat(0xbc1326, 0.02, 0.63);
    redLeather.bumpMap = leather.bumpMap;
    redLeather.bumpScale = 0.0002;
    function rimPoint(angle, cross, offset = 0) {
      // Thumb rests swell inward; the outside keeps the photographed 330 mm diameter.
      const swell =
        0.008 *
        Math.exp(-(((Math.abs(Math.cos(angle)) - 0.985) / 0.055) ** 2)) *
        Math.exp(-(((Math.sin(angle) - 0.17) / 0.32) ** 2));
      const radius = 0.15 - swell / 2;
      const radial = radius + (0.015 + swell / 2 + offset) * Math.cos(cross);
      return [
        radial * Math.cos(angle),
        radial * Math.sin(angle),
        0.025 + (0.017 + swell * 0.25 + offset) * Math.sin(cross)
      ];
    }
    function leatherArc(start, end, material, offset = 0) {
      const lengthSegments = Math.max(10, Math.ceil((end - start) * 32)),
        crossSegments = 24;
      const positions = [],
        uvs = [],
        indices = [];
      for (let i = 0; i <= lengthSegments; i++)
        for (let j = 0; j <= crossSegments; j++) {
          const a = start + ((end - start) * i) / lengthSegments;
          positions.push(...rimPoint(a, (j / crossSegments) * Math.PI * 2, offset));
          uvs.push(a / (Math.PI * 2), j / crossSegments);
          if (i < lengthSegments && j < crossSegments) {
            const k = i * (crossSegments + 1) + j;
            indices.push(k, k + crossSegments + 1, k + 1, k + 1, k + crossSegments + 1, k + crossSegments + 2);
          }
        }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return add(geometry, material);
    }
    leatherArc(0, Math.PI * 2, leather).name = '330R sculpted leather rim';
    leatherArc(Math.PI / 2 - 0.038, Math.PI / 2 + 0.038, redLeather, 0.00035).name = 'Red twelve-o’clock marker';
    const sewing = [];
    for (let i = 0; i < 210; i++) {
      const a = (i / 210) * Math.PI * 2;
      // Cross-stitch along the inner leather join, with a break at the centre stripe.
      if (Math.abs(a - Math.PI / 2) < 0.05) continue;
      sewing.push(...rimPoint(a, 2.23, 0.0003), ...rimPoint(a + 0.018, 2.5, 0.0003));
      sewing.push(...rimPoint(a, 2.5, 0.0003), ...rimPoint(a + 0.018, 2.23, 0.0003));
    }
    const stitchGeometry = new THREE.BufferGeometry();
    stitchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sewing, 3));
    const stitching = new THREE.LineSegments(stitchGeometry, new THREE.LineBasicMaterial({ color: 0xae3037 }));
    stitching.name = 'Red leather cross-stitching';
    group.add(stitching);

    const carbonCanvas = document.createElement('canvas');
    carbonCanvas.width = carbonCanvas.height = 512;
    const ctx = carbonCanvas.getContext('2d');
    ctx.fillStyle = '#131517';
    ctx.fillRect(0, 0, 512, 512);
    let seed = 287;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 1800; i++) {
      const x = random() * 512,
        y = random() * 512,
        shade = 24 + Math.floor(random() * 24);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(random() * Math.PI);
      ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 3})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(10 + random() * 14, -3);
      ctx.lineTo(15 + random() * 16, 4);
      ctx.lineTo(3, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const carbonFace = mat(0xffffff, 0.2, 0.46);
    carbonFace.map = new THREE.CanvasTexture(carbonCanvas);
    carbonFace.map.colorSpace = THREE.SRGBColorSpace;
    carbonFace.map.anisotropy = 4;
    const hub = [
      [-0.094, 0.05],
      [-0.078, 0.07],
      [-0.064, 0.074],
      [-0.045, 0.055],
      [-0.032, 0.05],
      [0.032, 0.05],
      [0.045, 0.055],
      [0.064, 0.074],
      [0.078, 0.07],
      [0.094, 0.05],
      [0.085, 0.03],
      [0.075, 0.018],
      [0.075, -0.014],
      [0.088, -0.032],
      [0.093, -0.059],
      [0.084, -0.069],
      [0.054, -0.068],
      [0.034, -0.056],
      [-0.034, -0.056],
      [-0.054, -0.068],
      [-0.084, -0.069],
      [-0.093, -0.059],
      [-0.088, -0.032],
      [-0.075, -0.014],
      [-0.075, 0.018],
      [-0.085, 0.03]
    ];
    plate(hub, 0.031, black, -0.011, 0.003).name = 'NEO X molded rear housing';
    plate(hub, 0.003, carbonFace, 0.008, 0.0012).name = 'NEO X forged-carbon control plate';

    const brushedCanvas = document.createElement('canvas');
    brushedCanvas.width = brushedCanvas.height = 256;
    const bc = brushedCanvas.getContext('2d');
    bc.fillStyle = '#25282a';
    bc.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      const shade = 30 + Math.floor(random() * 17);
      bc.fillStyle = `rgb(${shade},${shade + 2},${shade + 3})`;
      bc.fillRect(0, y, 256, 0.6);
    }
    const brushed = mat(0xffffff, 0.65, 0.44);
    brushed.map = new THREE.CanvasTexture(brushedCanvas);
    brushed.map.colorSpace = THREE.SRGBColorSpace;
    for (const side of [-1, 1]) {
      const spoke = [
        [side * 0.027, 0.033],
        [side * 0.069, 0.032],
        [side * 0.14, 0.021],
        [side * 0.144, -0.016],
        [side * 0.088, -0.024],
        [side * 0.027, -0.031]
      ];
      plate(side < 0 ? spoke.reverse() : spoke, 0.005, brushed, 0.019, 0.0015).name = 'Brushed aluminum lateral spoke';
      // Thin leather sleeves curve into the rim while keeping a shallow face.
      const sleeve = new THREE.Shape();
      sleeve.moveTo(0.106, -0.024);
      sleeve.quadraticCurveTo(0.127, -0.028, 0.15, -0.019);
      sleeve.lineTo(0.153, 0.023);
      sleeve.quadraticCurveTo(0.13, 0.032, 0.107, 0.026);
      sleeve.quadraticCurveTo(0.104, 0.002, 0.106, -0.024);
      sleeve.closePath();
      const sleeveGeometry = new THREE.ExtrudeGeometry(sleeve, {
        depth: 0.008,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.003,
        bevelSegments: 4,
        curveSegments: 20
      });
      sleeveGeometry.translate(0, 0, -0.004);
      const palm = add(sleeveGeometry, leather, 0, 0, 0.022);
      palm.scale.x = side;
    }
    plate(
      [
        [-0.026, -0.025],
        [0.026, -0.025],
        [0.018, -0.082],
        [0.02, -0.14],
        [-0.02, -0.14],
        [-0.018, -0.082]
      ],
      0.005,
      brushed,
      0.019,
      0.0015
    ).name = 'Tapered lower spoke';
    plate(
      [
        [-0.015, -0.106],
        [0.015, -0.106],
        [0.021, -0.145],
        [-0.021, -0.145]
      ],
      0.008,
      leather,
      0.022,
      0.003
    );
    disk(0.041, 0.006, edge, 0, 0, 0.024, 64);
    disk(0.0388, 0.0015, brushed, 0, 0, 0.0275, 64);
    disk(0.03, 0.003, black, 0, 0, 0.029, 64);
    ring(0.029, 0.0005, edge, 0, 0, 0.0308);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 3;
      const x = Math.cos(a) * 0.035,
        y = Math.sin(a) * 0.035;
      disk(0.0045, 0.0014, rubber, x, y, 0.029, 24);
      disk(0.0024, 0.0005, edge, x, y, 0.03, 6);
    }
    const emblemCanvas = document.createElement('canvas');
    emblemCanvas.width = emblemCanvas.height = 256;
    const ec = emblemCanvas.getContext('2d');
    ec.fillStyle = '#f0f0ec';
    ec.beginPath();
    [
      [116, 58],
      [210, 58],
      [191, 89],
      [139, 89],
      [128, 106],
      [168, 106],
      [185, 125],
      [153, 181],
      [62, 181],
      [82, 149],
      [133, 149],
      [145, 130],
      [108, 130],
      [91, 112]
    ].forEach(([x, y], i) => (i ? ec.lineTo(x, y) : ec.moveTo(x, y)));
    ec.closePath();
    ec.fill();
    ec.fillStyle = '#d72535';
    for (const [x, y] of [
      [79, 81],
      [58, 114],
      [38, 147]
    ]) {
      ec.beginPath();
      ec.moveTo(x, y);
      ec.lineTo(x + 31, y);
      ec.lineTo(x + 20, y + 21);
      ec.lineTo(x - 11, y + 21);
      ec.closePath();
      ec.fill();
    }
    const logoMap = new THREE.CanvasTexture(emblemCanvas);
    logoMap.colorSpace = THREE.SRGBColorSpace;
    add(
      new THREE.PlaneGeometry(0.035, 0.035),
      new THREE.MeshStandardMaterial({
        map: logoMap,
        transparent: true,
        depthWrite: false,
        roughness: 0.6
      }),
      0,
      0,
      0.031
    ).name = 'SIMAGIC hub emblem';
    for (const side of [-1, 1]) {
      button(side * 0.064, 0.063, side < 0 ? '+' : '−', side < 0 ? 0xd9e2ee : 0xe95d66);
      button(side * 0.08, 0.048, side < 0 ? 'PIT' : 'LIM', 0x6e9feb);
      button(side * 0.065, -0.038, 'I', 0xe8ce82);
      button(side * 0.079, -0.059, side < 0 ? 'ON' : 'SET', side < 0 ? 0x79d4ba : 0x68bfea);
      knob(side * 0.046, -0.053, '', side < 0 ? 0xe6a64f : 0x5b94ef);
      funky(side * 0.049, 0.051);
      thumb(side, -0.04);
      for (const y of [0.038, -0.042]) screw(side * 0.068, y, 0.011);
    }
    add(new THREE.BoxGeometry(0.067, 0.007, 0.003), rubber, 0, 0.049, 0.013);
    for (let i = 0; i < 9; i++) {
      const color = i < 3 ? 0x38ceac : i < 6 ? 0xd4df66 : 0xe74641;
      const led = mat(color, 0.02, 0.4);
      led.emissive = new THREE.Color(color);
      led.emissiveIntensity = 0.65;
      add(new THREE.BoxGeometry(0.0047, 0.0035, 0.001), led, (i - 4) * 0.0068, 0.049, 0.015);
    }
    const topBrand = caption('SIMAGIC', 0.048, 0.008, 0, 0.0525, -0.003);
    topBrand.rotation.x = -Math.PI / 2;
    // UP+ modules, adjustable fasteners, shift paddles and lower clutch paddles.
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.023, 0.04, 0.027), black, side * 0.064, 0, -0.043);
      const upper = [
        [side * 0.066, 0.035],
        [side * 0.109, 0.044],
        [side * 0.12, 0.031],
        [side * 0.112, -0.021],
        [side * 0.084, -0.03],
        [side * 0.072, -0.014]
      ];
      plate(side < 0 ? upper.reverse() : upper, 0.003, edge, -0.056, 0.001);
      const lower = [
        [side * 0.061, -0.019],
        [side * 0.106, -0.02],
        [side * 0.11, -0.049],
        [side * 0.079, -0.061],
        [side * 0.061, -0.049]
      ];
      plate(side < 0 ? lower.reverse() : lower, 0.003, black, -0.063, 0.001);
      const pin = add(new THREE.CylinderGeometry(0.004, 0.004, 0.032, 16), silver, side * 0.074, 0.005, -0.045);
      pin.rotation.z = side * 0.12;
      for (const y of [-0.012, 0.014]) disk(0.003, 0.002, silver, side * 0.061, y, -0.058);
    }
    disk(0.034, 0.022, edge, 0, 0, -0.041, 48);
    disk(0.027, 0.028, black, 0, 0, -0.065, 48);
    return group;
  }

  // Body perimeter and molded rear shell share the necked GT outline.
  const outline = [
    [-0.127, 0.072],
    [-0.112, 0.086],
    [-0.084, 0.069],
    [-0.055, 0.055],
    [0.055, 0.055],
    [0.084, 0.069],
    [0.112, 0.086],
    [0.127, 0.072],
    [0.111, 0.046],
    [0.088, 0.032],
    [0.076, 0.011],
    [0.083, -0.016],
    [0.079, -0.063],
    [0.066, -0.078],
    [-0.066, -0.078],
    [-0.079, -0.063],
    [-0.083, -0.016],
    [-0.076, 0.011],
    [-0.088, 0.032],
    [-0.111, 0.046]
  ];
  const carbon = document.createElement('canvas');
  carbon.width = carbon.height = 512;
  const cc = carbon.getContext('2d');
  cc.fillStyle = savu ? '#282b2e' : '#131517';
  cc.fillRect(0, 0, 512, 512);
  let carbonSeed = 2147;
  const carbonRandom = () => {
    carbonSeed = (Math.imul(carbonSeed, 1664525) + 1013904223) >>> 0;
    return carbonSeed / 4294967296;
  };
  if (!savu)
    for (let i = 0; i < 1500; i++) {
      const x = carbonRandom() * 512,
        y = carbonRandom() * 512,
        r = carbonRandom() * 13,
        v = 23 + carbonRandom() * 17;
      cc.save();
      cc.translate(x, y);
      cc.rotate(carbonRandom() * Math.PI);
      cc.fillStyle = `rgb(${v},${v + 2},${v + 3})`;
      cc.beginPath();
      cc.moveTo(0, 0);
      cc.lineTo(r + 3, -3);
      cc.lineTo(r + 9, 5);
      cc.lineTo(3, 8);
      cc.closePath();
      cc.fill();
      cc.restore();
    }
  const face = mat(0xffffff, savu ? 0.62 : 0.2, savu ? 0.4 : 0.55);
  face.map = new THREE.CanvasTexture(carbon);
  face.map.colorSpace = THREE.SRGBColorSpace;
  face.map.anisotropy = 4;
  plate(outline, 0.031, black, -0.01, 0.004);
  plate(outline, 0.004, face, 0.01, 0.0012);
  // Each molded grip wraps two finger apertures around the thumb bridge.
  for (const side of [-1, 1]) {
    grip([
      [side * 0.117, 0.071, 0.001],
      [side * 0.132, 0.044, 0.009],
      [side * 0.133, 0.004, 0.011],
      [side * 0.13, -0.038, 0.01],
      [side * 0.119, -0.067, 0.005],
      [side * 0.083, -0.066, 0.004]
    ]);
    grip([
      [side * 0.132, 0.002, 0.008],
      [side * 0.112, 0.005, 0.012],
      [side * 0.093, 0.013, 0.015],
      [side * 0.078, 0.009, 0.011]
    ]);
    for (const [x, y] of [
      [0.111, 0.067],
      [0.083, 0.051],
      [0.075, -0.018],
      [0.068, -0.065]
    ])
      screw(side * x, y, 0.015);
  }
  if (!savu && variant === 'gt-neo') {
    const cap = mat(0x797d80, 0.25, 0.52);
    for (const side of [-1, 1]) {
      const points = [
        [side * 0.116, 0.077],
        [side * 0.127, 0.071],
        [side * 0.139, 0.047],
        [side * 0.13, 0.043],
        [side * 0.12, 0.06]
      ];
      plate(side < 0 ? points.reverse() : points, 0.016, cap, 0.007, 0.003);
    }
  }
  function button(x, y, label, color) {
    disk(0.0102, 0.0035, black, x, y, 0.0155);
    const glow = mat(color, 0.18, 0.38);
    glow.emissive = new THREE.Color(color);
    glow.emissiveIntensity = 0.27;
    ring(0.0083, 0.001, glow, x, y, 0.018);
    const litCap = variant === 'gt-neo' && y > 0.025;
    disk(0.0074, 0.003, litCap ? glow : rubber, x, y, 0.019);
    caption(label, 0.0112, 0.0048, x, y, 0.0207, litCap ? '#24272a' : '#e5e7e8');
  }
  function knob(x, y, label, color = 0x737d87) {
    const ringMat = mat(color, 0.45, 0.4);
    ringMat.emissive = new THREE.Color(color);
    ringMat.emissiveIntensity = 0.12;
    disk(0.013, 0.0025, black, x, y, 0.016);
    ring(0.0112, 0.0013, ringMat, x, y, 0.018);
    disk(0.0088, 0.012, black, x, y, 0.023);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const ridge = add(
        new THREE.BoxGeometry(0.0018, 0.0028, 0.009),
        edge,
        x + Math.cos(a) * 0.0087,
        y + Math.sin(a) * 0.0087,
        0.0235
      );
      ridge.rotation.z = a;
    }
    const ticks = [];
    for (let k = 0; k < 11; k++) {
      const a = ((-220 + k * 26) * Math.PI) / 180;
      for (const r of [0.014, 0.0155]) ticks.push(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.0154);
    }
    const tickGeometry = new THREE.BufferGeometry();
    tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    const graduations = new THREE.LineSegments(tickGeometry, new THREE.LineBasicMaterial({ color: 0x8d9398 }));
    graduations.name = 'Rotary encoder graduations';
    group.add(graduations);
    disk(0.0072, 0.001, black, x, y, 0.0295);
    add(new THREE.BoxGeometry(0.0012, 0.004, 0.0005), silver, x, y + 0.0035, 0.0303);
    caption(label, 0.017, 0.004, x, y - 0.018, 0.0154, '#bdc4cc');
  }
  function funky(x, y) {
    disk(0.0055, 0.008, black, x, y, 0.022, 12);
    disk(0.0041, 0.001, silver, x, y, 0.0265, 8);
  }
  function thumb(side, y) {
    const g = new THREE.Group();
    g.position.set(side * 0.087, y, 0.022);
    group.add(g);
    const material = mat(savu ? 0x4b4f55 : 0xb63c32, 0.3, 0.42);
    const barrel = add(new THREE.CylinderGeometry(0.009, 0.009, 0.013, 16), material, 0, 0, 0, g);
    barrel.rotation.z = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const b = add(
        new THREE.BoxGeometry(0.014, 0.0022, 0.0022),
        black,
        0,
        Math.cos(a) * 0.0088,
        Math.sin(a) * 0.0088,
        g
      );
      b.rotation.x = a;
    }
  }
  if (savu) {
    const colors = [0xb4d7e2, 0xefcf7f, 0x8cb8e0, 0xe08282, 0xa2d4a2, 0xe6e1cd];
    for (const side of [-1, 1]) {
      const pts = [
        [0.114, 0.064],
        [0.095, 0.056],
        [0.076, 0.047],
        [0.067, -0.021],
        [0.052, -0.032],
        [0.063, -0.048]
      ];
      pts.forEach(([x, y], i) => button(side * x, y, ['PIT', 'RAD', 'LIM', 'TC', 'ABS', 'DRS'][i], colors[i]));
      funky(side * 0.062, -0.004);
      thumb(side, 0.019);
      // Shoulder thumb roller, distinct from vertical thumb encoders.
      const r = add(new THREE.CylinderGeometry(0.005, 0.005, 0.018, 16), edge, side * 0.123, 0.04, 0.019);
      r.rotation.z = side * 0.4;
    }
    knob(-0.037, 0.025, 'TC');
    knob(0.037, 0.025, 'ABS');
    knob(0, -0.034, 'MAP');
    for (const side of [-1, 1]) {
      disk(0.008, 0.004, black, side * 0.026, -0.056, 0.018);
      add(new THREE.BoxGeometry(0.003, 0.013, 0.006), silver, side * 0.026, -0.056, 0.021);
    }
    caption('SIMUCUBE', 0.055, 0.007, 0, 0.002, 0.0153);
    // Hexagonal marque above the manufacturer's word mark.
    ring(0.007, 0.0006, silver, 0, 0.027, 0.016);
  } else {
    const namesL = ['RAD', 'PIT', 'LIM', 'TC', 'FLASH'],
      namesR = ['PIT', 'DRS', 'ERS', 'ABS', 'START'];
    const colors = [0xf4e6bc, 0xf4e6bc, 0xf4e6bc, 0xec263e, 0xec263e];
    for (const side of [-1, 1]) {
      [
        [0.112, 0.066],
        [0.093, 0.055],
        [0.078, 0.039],
        [0.074, -0.027],
        [0.071, -0.059]
      ].forEach(([x, y], i) => button(side * x, y, (side < 0 ? namesL : namesR)[i], colors[i]));
      thumb(side, 0.006);
      funky(side * 0.056, -0.025);
    }
    knob(-0.035, 0.016, 'TC', 0xd32b3a);
    knob(0.035, 0.016, 'ABS', 0xd32b3a);
    knob(-0.026, -0.053, 'MAP', 0xd32b3a);
    knob(0.026, -0.053, 'BRAKE', 0xd32b3a);
    caption('SIMAGIC', 0.094, 0.014, 0, 0.043, 0.0154);
    caption('GT NEO', 0.028, 0.006, 0, -0.021, 0.0154, '#9c9fa2');
  }
  // GT Neo has a wordmark across its bridge; the preview Savu keeps its LED strip.
  if (savu) {
    const ledCount = 15,
      ledY = 0.047;
    add(new THREE.BoxGeometry(0.104, 0.008, 0.0025), rubber, 0, ledY, 0.016);
    for (let i = 0; i < ledCount; i++) {
      const color = i < 5 ? 0x54be82 : i < 10 ? 0xe5cc68 : 0xda6362;
      const light = mat(color, 0.02, 0.44);
      light.emissive = new THREE.Color(color);
      light.emissiveIntensity = 0.45;
      add(new THREE.BoxGeometry(0.0043, 0.0042, 0.001), light, (i - (ledCount - 1) / 2) * 0.0065, ledY, 0.018);
    }
  }
  // Rear mounting flange, bolts, paddle pivots and two independent paddle pairs.
  disk(0.035, 0.015, edge, 0, 0, -0.035, 32);
  disk(0.027, 0.024, black, 0, 0, -0.05, 32);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    disk(0.0027, 0.002, silver, Math.cos(a) * 0.026, Math.sin(a) * 0.026, -0.044, 12);
  }
  for (const side of [-1, 1]) {
    const hinge = add(new THREE.BoxGeometry(0.023, 0.035, 0.022), black, side * 0.069, 0.011, -0.041);
    hinge.rotation.z = side * 0.11;
    const points = [
      [side * 0.067, 0.047],
      [side * 0.112, 0.056],
      [side * 0.119, 0.035],
      [side * 0.109, -0.005],
      [side * 0.078, -0.008]
    ];
    plate(side < 0 ? points.reverse() : points, 0.003, edge, -0.05, 0.001);
    const lower = [
      [side * 0.065, -0.025],
      [side * 0.108, -0.022],
      [side * 0.112, -0.05],
      [side * 0.079, -0.064],
      [side * 0.066, -0.052]
    ];
    plate(side < 0 ? lower.reverse() : lower, 0.003, black, -0.047, 0.001);
    const pivot = add(new THREE.CylinderGeometry(0.004, 0.004, 0.037, 12), silver, side * 0.076, 0.015, -0.041);
    pivot.rotation.z = 0.1;
    disk(0.005, 0.006, black, side * 0.063, -0.038, -0.039);
  }
  const bounds = new THREE.Box3().setFromObject(group);
  group.scale.x = (savu ? 0.295 : 0.3) / (bounds.max.x - bounds.min.x);
  if (!savu) group.scale.y = 0.156 / (bounds.max.y - bounds.min.y);
  return group;
}
