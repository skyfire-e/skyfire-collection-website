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
    const segments = 40,
      rings = 12;
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
    // Full 330 mm leather rim and three metal spokes around the Neo X hub.
    add(new THREE.TorusGeometry(0.15, 0.015, 20, 96), rubber);
    const seam = mat(0x6c6460, 0, 0.95);
    add(new THREE.TorusGeometry(0.148, 0.0006, 5, 96), seam, 0, 0, 0.0148);
    add(new THREE.TorusGeometry(0.152, 0.0006, 5, 96), seam, 0, 0, 0.0148);
    for (const side of [-1, 1]) {
      const points = [
        [side * 0.025, 0.031],
        [side * 0.142, 0.035],
        [side * 0.145, -0.008],
        [side * 0.025, -0.031]
      ];
      plate(side < 0 ? points.reverse() : points, 0.006, edge, -0.003, 0.0015);
      const swell = add(new THREE.SphereGeometry(0.018, 18, 12), rubber, side * 0.143, 0.033, 0.002);
      swell.scale.set(0.8, 1.5, 1.05);
    }
    plate(
      [
        [-0.029, -0.015],
        [0.029, -0.015],
        [0.023, -0.145],
        [-0.023, -0.145]
      ],
      0.006,
      edge,
      -0.003,
      0.002
    );
    const hub = [
      [-0.091, 0.043],
      [-0.066, 0.062],
      [0.066, 0.062],
      [0.091, 0.043],
      [0.085, -0.046],
      [0.057, -0.067],
      [-0.057, -0.067],
      [-0.085, -0.046]
    ];
    plate(hub, 0.03, black, -0.025, 0.005);
    plate(hub, 0.004, edge, -0.006, 0.0015);
    disk(0.03, 0.007, black, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      screw(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.002);
    }
    caption('SIMAGIC', 0.048, 0.009, 0, 0.006, 0.005);
    caption('NEO X', 0.032, 0.006, 0, -0.009, 0.005, '#aeb5b9');
    for (const side of [-1, 1]) {
      [
        [0.064, 0.043],
        [0.078, 0.018],
        [0.07, -0.009]
      ].forEach(([x, y], i) => button(side * x, y, ['PIT', 'RAD', 'LIM'][i], [0x5c9dce, 0xd7b951, 0xbc5a59][i]));
      knob(side * 0.051, -0.04, side < 0 ? 'TC' : 'ABS', 0x707e89);
      funky(side * 0.041, 0.042);
      const hinge = add(new THREE.BoxGeometry(0.022, 0.035, 0.024), black, side * 0.07, 0, -0.052);
      hinge.rotation.z = side * 0.08;
      const paddle = [
        [side * 0.068, 0.054],
        [side * 0.115, 0.063],
        [side * 0.119, 0.029],
        [side * 0.112, -0.048],
        [side * 0.079, -0.052]
      ];
      plate(side < 0 ? paddle.reverse() : paddle, 0.003, black, -0.067, 0.001);
    }
    disk(0.034, 0.022, edge, 0, 0, -0.056, 32);
    disk(0.027, 0.025, black, 0, 0, -0.079, 32);
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
  cc.fillStyle = savu ? '#282b2e' : '#222629';
  cc.fillRect(0, 0, 512, 512);
  if (!savu)
    for (let i = 0; i < 1300; i++) {
      const x = (i * 149) % 512,
        y = (i * 239) % 512,
        r = (i * 83) % 18,
        v = 37 + (i % 8) * 4;
      cc.fillStyle = `rgb(${v},${v + 2},${v + 3})`;
      cc.beginPath();
      cc.moveTo(x, y);
      cc.lineTo(x + r + 3, y - 3);
      cc.lineTo(x + r + 9, y + 5);
      cc.lineTo(x + 3, y + 8);
      cc.closePath();
      cc.fill();
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
  function button(x, y, label, color) {
    disk(0.0102, 0.0035, black, x, y, 0.0155);
    const glow = mat(color, 0.18, 0.38);
    glow.emissive = new THREE.Color(color);
    glow.emissiveIntensity = 0.27;
    ring(0.0083, 0.001, glow, x, y, 0.018);
    disk(0.0074, 0.003, rubber, x, y, 0.019);
    caption(label, 0.0112, 0.0048, x, y, 0.0207, '#e5e7e8');
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
    const colors = [0xe6b64d, 0x69b377, 0x5d9fc9, 0xe1c250, 0xc96460];
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
    knob(-0.035, 0.016, 'TC', 0x497fae);
    knob(0.035, 0.016, 'ABS', 0x497fae);
    knob(-0.026, -0.053, 'MAP', 0x865ec3);
    knob(0.026, -0.053, 'BRAKE', 0x865ec3);
    caption('SIMAGIC', 0.057, 0.008, 0, -0.021, 0.0154);
  }
  // Recessed telemetry lens and discrete LEDs, never an emissive billboard.
  const ledCount = savu ? 15 : 15,
    ledY = savu ? 0.047 : 0.043;
  add(new THREE.BoxGeometry(0.104, 0.008, 0.0025), rubber, 0, ledY, 0.016);
  for (let i = 0; i < ledCount; i++) {
    const color = i < 5 ? 0x54be82 : i < 10 ? 0xe5cc68 : 0xda6362;
    const light = mat(color, 0.02, 0.44);
    light.emissive = new THREE.Color(color);
    light.emissiveIntensity = 0.45;
    add(new THREE.BoxGeometry(0.0043, 0.0042, 0.001), light, (i - (ledCount - 1) / 2) * 0.0065, ledY, 0.018);
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
  return group;
}
