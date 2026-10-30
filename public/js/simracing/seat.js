/**
 * Original BRIDE Low Max replica seat study, shaped to the owner's photograph.
 * References: BRIDE STRADIA II / III gradation seats (brideseats.com).
 * This is visual reconstruction, not manufacturer CAD or a dimensional model.
 * Coordinates are world metres: front -Z, driver's right +X, up +Y.
 */
export function createSeat(THREE) {
  const seat = new THREE.Group();
  seat.name = 'BRIDE Low Max replica with OMP harness';
  const clamp = THREE.MathUtils.clamp;
  const v = (p) => new THREE.Vector3(...p);
  let seed = 417;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function canvas(width, height, draw) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    draw(c.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }
  const weave = canvas(256, 256, (ctx, w, h) => {
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = 116 + random() * 35 + (x % 4 < 2 !== y % 4 < 2 ? 20 : -15);
        const i = (y * w + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = n;
        image.data[i + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  });
  weave.colorSpace = THREE.NoColorSpace;
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(5, 7);
  const black = new THREE.MeshStandardMaterial({
    color: 0x28292c,
    roughness: 0.86,
    metalness: 0.02,
    bumpMap: weave,
    bumpScale: 0.0007
  });
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x24262b,
    roughness: 0.46,
    metalness: 0.16,
    bumpMap: weave,
    bumpScale: 0.00025
  });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.42, metalness: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x777d83, roughness: 0.36, metalness: 0.68 });
  const stitching = new THREE.MeshStandardMaterial({ color: 0xa03537, roughness: 0.88 });
  const red = new THREE.MeshStandardMaterial({
    color: 0xd71730,
    roughness: 0.8,
    metalness: 0,
    bumpMap: weave,
    bumpScale: 0.0005,
    side: THREE.DoubleSide
  });
  const gradation = canvas(1024, 1536, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#92948f');
    gradient.addColorStop(0.5, '#c5c2b3');
    gradient.addColorStop(1, '#d4cebb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'italic 900 117px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (let row = -1; row < 8; row++) {
      ctx.fillStyle = row < 3 ? '#50534f' : '#737164';
      for (let col = -1; col < 4; col++) ctx.fillText('BRIDE', col * 403 + (row % 2) * 22, row * 224 + 90);
    }
    // The woven grain is also visible in diffuse color, not only in normal light.
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,.055)' : 'rgba(20,22,20,.06)';
      ctx.fillRect(random() * w, random() * h, 1, 3);
    }
  });
  const fabric = new THREE.MeshStandardMaterial({ map: gradation, roughness: 0.96, bumpMap: weave, bumpScale: 0.0007 });

  let componentId = 'seat';
  function add(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.componentId = componentId;
    mesh.castShadow = mesh.receiveShadow = true;
    if (name) mesh.name = name;
    seat.add(mesh);
    return mesh;
  }
  function path(points, radius, material, segments = 80) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)), segments, radius, 6, false), material);
  }
  const stations = [
    [0.38, 0.155],
    [0.45, 0.19],
    [0.56, 0.205],
    [0.69, 0.222],
    [0.8, 0.265],
    [0.855, 0.275],
    [0.91, 0.236],
    [0.96, 0.19],
    [1.01, 0.168],
    [1.11, 0.155],
    [1.16, 0.136],
    [1.195, 0.087],
    [1.215, 0.001]
  ];
  // Shared derivatives make the silhouette C1-continuous through all stations.
  // Per-segment smoothstep would stop the slope at every knot and form ripples.
  const widthSlopes = stations.map((_, i) => {
    if (stations[i][0] === 1.11) return 0;
    const a = stations[Math.max(0, i - 1)],
      b = stations[Math.min(stations.length - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  function widthAt(y) {
    // The crown is a continuous half-ellipse, not two disconnected side trims.
    if (y >= 1.11) return 0.155 * Math.sqrt(Math.max(0, 1 - ((y - 1.11) / 0.105) ** 2));
    for (let i = 1; i < stations.length; i++)
      if (y <= stations[i][0]) {
        const [a, wa] = stations[i - 1],
          [b, wb] = stations[i];
        const span = b - a,
          t = clamp((y - a) / span, 0, 1),
          t2 = t * t,
          t3 = t2 * t;
        return Math.max(
          0.001,
          (2 * t3 - 3 * t2 + 1) * wa +
            (t3 - 2 * t2 + t) * span * widthSlopes[i - 1] +
            (-2 * t3 + 3 * t2) * wb +
            (t3 - t2) * span * widthSlopes[i]
        );
      }
    return 0.001;
  }
  function surfaceZ(x, y) {
    const yNorm = clamp((y - 0.38) / 0.835, 0, 1);
    const depth = (0.032 + 0.104 * Math.exp(-Math.pow((y - 0.78) / 0.22, 2))) * clamp((1.215 - y) / 0.065, 0, 1);
    const lateral = clamp(Math.abs(x) / Math.max(widthAt(y), 0.02), 0, 1);
    return 0.535 + 0.235 * yNorm - depth * Math.pow(lateral, 2.6);
  }
  const holes = [-1, 1].map((side) => ({ x: side * 0.09, y: 1.012, rx: 0.048, ry: 0.025, angle: side * -0.2 }));
  function inHole(x, y, margin = 0) {
    return holes.some((h) => {
      const dx = x - h.x,
        dy = y - h.y;
      const a = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
      const b = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
      return (a / (h.rx + margin)) ** 2 + (b / (h.ry + margin)) ** 2 < 1;
    });
  }

  // Dense, smooth front and rear surfaces, with actual openings for both belts.
  function backSurface(rear) {
    const rows = 108,
      columns = 52,
      positions = [],
      uvs = [],
      indices = [];
    for (let row = 0; row <= rows; row++) {
      const y = 0.38 + (0.835 * row) / rows,
        half = widthAt(y);
      for (let col = 0; col <= columns; col++) {
        const x = ((col / columns) * 2 - 1) * half;
        positions.push(x, y, surfaceZ(x, y) + (rear ? 0.041 : 0));
        uvs.push(1 - col / columns, row / rows);
      }
    }
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const a = row * (columns + 1) + col,
          b = a + 1,
          c = a + columns + 1,
          d = c + 1;
        const x = (positions[a * 3] + positions[d * 3]) / 2,
          y = (positions[a * 3 + 1] + positions[d * 3 + 1]) / 2;
        if (inHole(x, y, 0.0025)) continue;
        if (rear) indices.push(a, b, c, b, d, c);
        else indices.push(a, c, b, b, c, d);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(geometry, rear ? shellMaterial : black, rear ? 'Curved rear shell' : 'Upholstered curved back');
  }
  backSurface(false);
  backSurface(true);

  // One unbroken upholstered perimeter crosses the crown and closes its thickness.
  const perimeter = [];
  for (let i = 0; i <= 80; i++) {
    const y = 0.39 + (0.72 * i) / 80,
      x = -widthAt(y);
    perimeter.push([x, y, surfaceZ(x, y) + 0.021]);
  }
  for (let i = 1; i <= 48; i++) {
    const theta = Math.PI * (1 - i / 48);
    const x = 0.155 * Math.cos(theta),
      y = 1.11 + 0.105 * Math.sin(theta);
    perimeter.push([x, y, surfaceZ(x, y) + 0.021]);
  }
  for (let i = 1; i <= 80; i++) {
    const y = 1.11 - (0.72 * i) / 80,
      x = widthAt(y);
    perimeter.push([x, y, surfaceZ(x, y) + 0.021]);
  }
  path(perimeter, 0.022, black, 256).name = 'Continuous upholstered crown and perimeter';
  path(
    perimeter.map(([x, y]) => [x * 0.97, y, surfaceZ(x * 0.97, y) - 0.002]),
    0.0009,
    stitching,
    256
  );

  // Plastic oval belt-hole grommets and curved inner tunnels.
  holes.forEach((h) => {
    function point(theta, outer, depth) {
      const a = (h.rx + outer) * Math.cos(theta),
        b = (h.ry + outer) * Math.sin(theta);
      const x = h.x + a * Math.cos(h.angle) - b * Math.sin(h.angle),
        y = h.y + a * Math.sin(h.angle) + b * Math.cos(h.angle);
      return [x, y, surfaceZ(x, y) + depth];
    }
    const positions = [],
      indices = [],
      uvs = [];
    const count = 64;
    // Outer face, inside lip, passage and rear lip are one smooth closed profile.
    const profile = [
      [0.009, -0.003],
      [0.005, -0.008],
      [0, -0.007],
      [-0.002, 0.003],
      [-0.002, 0.039],
      [0.005, 0.046],
      [0.009, 0.041]
    ];
    for (let j = 0; j < profile.length; j++)
      for (let i = 0; i <= count; i++) {
        positions.push(...point((i / count) * Math.PI * 2, ...profile[j]));
        uvs.push(i / count, j / profile.length);
      }
    for (let j = 0; j < profile.length - 1; j++)
      for (let i = 0; i < count; i++) {
        const a = j * (count + 1) + i,
          b = a + 1,
          c = a + count + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mat = plastic.clone();
    mat.side = THREE.DoubleSide;
    add(geometry, mat, 'Open harness grommet');
  });

  // Superellipsoid cushions give softly rounded corners and real stuffed volume.
  function pillow(size, centre, material, type = 'back', exponent = 0.3) {
    const positions = [],
      uvs = [],
      indices = [],
      rows = 24,
      cols = 40;
    const power = (n, e) => Math.sign(n) * Math.pow(Math.abs(n), e);
    for (let row = 0; row <= rows; row++)
      for (let col = 0; col <= cols; col++) {
        const lat = -Math.PI / 2 + (Math.PI * row) / rows,
          lon = (2 * Math.PI * col) / cols;
        const x = (size[0] / 2) * power(Math.cos(lat), exponent) * power(Math.cos(lon), exponent);
        let y = (size[1] / 2) * power(Math.sin(lat), exponent);
        let z = (size[2] / 2) * power(Math.cos(lat), exponent) * power(Math.sin(lon), exponent);
        if (type === 'back') z += surfaceZ(x, centre[1] + y) - surfaceZ(0, centre[1]);
        if (type === 'pan') y -= z * 0.13;
        positions.push(x + centre[0], y + centre[1], z + centre[2]);
        // All pads share one cloth field: 6–7 BRIDE rows across the full back,
        // roughly three across the complete seat pan, without resets at seams.
        const fabricV = type === 'pan' ? 0.15 + (0.45 * (z + centre[2] - 0.11)) / 0.41 : (y + centre[1] - 0.43) / 0.48;
        uvs.push(1 - (x / 0.32 + 0.5), fabricV);
      }
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const a = row * (cols + 1) + col,
          b = a + 1,
          c = a + cols + 1,
          d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return add(geo, material, 'Sculpted upholstery cushion');
  }
  pillow([0.43, 0.105, 0.48], [0, 0.365, 0.345], shellMaterial, 'pan', 0.35);
  pillow([0.315, 0.275, 0.052], [0, 0.565, surfaceZ(0, 0.565) - 0.026], fabric);
  pillow([0.313, 0.185, 0.048], [0, 0.807, surfaceZ(0, 0.807) - 0.025], fabric);
  pillow([0.32, 0.073, 0.285], [0, 0.423, 0.382], fabric, 'pan', 0.27);
  pillow([0.323, 0.09, 0.116], [0, 0.454, 0.173], fabric, 'pan', 0.31);
  for (const side of [-1, 1]) {
    pillow([0.112, 0.172, 0.44], [side * 0.213, 0.446, 0.345], black, 'pan', 0.45);
    const seam = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40,
        z = 0.137 + t * 0.418,
        y = 0.5 - 0.065 * t + 0.015 * Math.sin(t * Math.PI);
      seam.push([side * (0.2 + 0.011 * Math.sin(t * Math.PI)), y, z]);
    }
    path(seam, 0.001, stitching, 64);
    // Small recliner hinge, with stamped cover and exposed fastener.
    const hinge = add(new THREE.CylinderGeometry(0.048, 0.048, 0.018, 40), plastic, 'Reclining hinge');
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(side * 0.255, 0.405, 0.506);
    const fastener = add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), steel);
    fastener.rotation.z = Math.PI / 2;
    fastener.position.copy(hinge.position);
    fastener.position.x += side * 0.012;
  }

  function textMap(draw, w = 1024, h = 512) {
    return canvas(w, h, draw);
  }
  const brideMap = textMap((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3f1e9';
    ctx.font = 'italic 900 205px Arial, sans-serif';
    ctx.fillText('BRIDE', w / 2, 180, w * 0.96);
    ctx.fillStyle = '#d92c42';
    ctx.font = 'italic 90px Georgia, serif';
    ctx.fillText('Low MAX', w / 2, 360);
  });
  // The logo conforms to the rounded front of the headrest.
  function decal(map, width, height, centreY, offset = 0) {
    const nx = 20,
      ny = 12,
      pos = [],
      uv = [],
      idx = [];
    for (let row = 0; row <= ny; row++)
      for (let col = 0; col <= nx; col++) {
        const x = (col / nx - 0.5) * width,
          y = centreY + (row / ny - 0.5) * height;
        pos.push(x, y, surfaceZ(x, y) - 0.0015 + offset);
        uv.push(1 - col / nx, row / ny);
      }
    for (let row = 0; row < ny; row++)
      for (let col = 0; col < nx; col++) {
        const a = row * (nx + 1) + col,
          b = a + 1,
          c = a + nx + 1,
          d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return add(
      geo,
      new THREE.MeshStandardMaterial({
        map,
        transparent: true,
        alphaTest: 0.04,
        roughness: 0.85,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1
      }),
      'Embroidered BRIDE Low Max'
    );
  }
  decal(brideMap, 0.215, 0.106, 1.132);

  componentId = 'harness';
  // Woven belts follow continuous paths through the holes and over the cushions.
  function ribbon(points, width, material, widthAxis = [1, 0, 0]) {
    const curve = new THREE.CatmullRomCurve3(points.map(v)),
      segments = Math.max(100, (points.length - 1) * 12);
    const positions = [],
      uv = [],
      idx = [];
    for (let i = 0; i <= segments; i++) {
      const p = curve.getPoint(i / segments),
        t = curve.getTangent(i / segments);
      const across = v(widthAxis);
      const right = across
        .addScaledVector(t, -across.dot(t))
        .normalize()
        .multiplyScalar(width / 2);
      positions.push(...p.clone().sub(right).toArray(), ...p.clone().add(right).toArray());
      uv.push(0, i / segments, 1, i / segments);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(geo, material, 'OMP woven belt');
    return curve;
  }
  function rearHarnessHook(x) {
    // The MS120 rear crossmember is centred at Y .155 / Z .68;
    // its rear face is Z .70. Both plates sit directly on that face.
    const plate = add(new THREE.BoxGeometry(0.07, 0.065, 0.008), shellMaterial, 'Rear harness anchor plate');
    plate.position.set(x, 0.163, 0.704);
    for (const dx of [-0.022, 0.022]) {
      const bolt = add(new THREE.CylinderGeometry(0.006, 0.006, 0.007, 6), steel, 'Rear harness anchor bolt');
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x + dx, 0.163, 0.711);
    }
    const stem = add(new THREE.CylinderGeometry(0.005, 0.005, 0.036, 16), steel, 'Harness eye bolt stem');
    stem.rotation.x = Math.PI / 2;
    stem.position.set(x, 0.158, 0.725);
    const eye = add(new THREE.TorusGeometry(0.014, 0.004, 10, 32), steel, 'Harness eye bolt');
    eye.position.set(x, 0.172, 0.746);

    // The snap hook lies perpendicular to the eye, with a visible closing gate.
    path(
      [
        [x, 0.188, 0.741],
        [x, 0.181, 0.753],
        [x, 0.189, 0.768],
        [x, 0.224, 0.766],
        [x, 0.239, 0.753],
        [x, 0.231, 0.74],
        [x, 0.203, 0.738]
      ],
      0.004,
      steel,
      48
    ).name = 'Rear harness snap hook';
    path(
      [
        [x, 0.203, 0.738],
        [x, 0.188, 0.741]
      ],
      0.002,
      steel,
      4
    ).name = 'Snap hook closing gate';
    for (const y of [0.241, 0.263]) {
      const bar = add(new THREE.BoxGeometry(0.058, 0.006, 0.008), steel, 'Harness webbing slot');
      bar.position.set(x, y, 0.755);
    }
    for (const dx of [-0.026, 0.026]) {
      const side = add(new THREE.BoxGeometry(0.006, 0.022, 0.008), steel, 'Harness webbing slot');
      side.position.set(x + dx, 0.252, 0.755);
    }
    // A short folded return closes around the metal slot, rather than ending in mid-air.
    ribbon(
      [
        [x, 0.305, 0.752],
        [x, 0.29, 0.765],
        [x, 0.265, 0.764],
        [x, 0.263, 0.755],
        [x, 0.27, 0.746]
      ],
      0.045,
      red
    );
    return [x, 0.27, 0.746];
  }
  const omp = textMap((ctx, w, h) => {
    ctx.fillStyle = '#18191b';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6d6b54';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f3df65';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 900 240px Arial';
    ctx.fillText('OMP', w / 2, h * 0.47, w * 0.85);
    ctx.fillStyle = '#e7e3c9';
    ctx.font = '32px Arial';
    ctx.fillText('RACING', w / 2, h * 0.82);
  });
  for (const side of [-1, 1]) {
    const hx = side * 0.09,
      hy = 1.012,
      hz = surfaceZ(hx, hy);
    const rearAnchor = rearHarnessHook(side * 0.135);
    ribbon(
      [
        rearAnchor,
        [side * 0.135, 0.33, 0.755],
        [side * 0.125, 0.49, 0.77],
        [side * 0.115, 0.68, 0.79],
        [hx, 0.9, hz + 0.075],
        [hx, hy + 0.013, hz + 0.05],
        [hx, hy + 0.011, hz - 0.011],
        [side * 0.094, 0.94, surfaceZ(side * 0.094, 0.94) - 0.021],
        // Clear the raised upper cushion before the belt reaches its top edge.
        // The outer strap edge also needs room over the concave backrest.
        [side * 0.098, 0.916, surfaceZ(side * 0.098, 0.916) - 0.055],
        [side * 0.102, 0.885, surfaceZ(side * 0.102, 0.885) - 0.068],
        [side * 0.106, 0.81, surfaceZ(side * 0.106, 0.81) - 0.068],
        [side * 0.102, 0.72, surfaceZ(side * 0.102, 0.72) - 0.069],
        [side * 0.096, 0.62, surfaceZ(side * 0.096, 0.62) - 0.071],
        [side * 0.067, 0.466, 0.458],
        [side * 0.025, 0.479, 0.32]
      ],
      0.045,
      red
    );
    const patch = add(
      new THREE.PlaneGeometry(0.049, 0.085),
      new THREE.MeshStandardMaterial({ map: omp, roughness: 0.93, side: THREE.DoubleSide }),
      'OMP shoulder pad label'
    );
    patch.position.set(side * 0.105, 0.813, surfaceZ(side * 0.106, 0.81) - 0.074);
    patch.rotation.set(0.29, Math.PI, side * -0.03);
    // Two steel adjuster slots on each shoulder strap.
    for (const yy of [0.688, 0.711]) {
      const bar = add(new THREE.BoxGeometry(0.052, 0.008, 0.007), steel);
      bar.position.set(side * 0.101, yy, surfaceZ(side * 0.1, yy) - 0.077);
      bar.rotation.x = 0.28;
    }
    // Wrap outside the hip bolster, then over its crown before dropping to the
    // latch. The full ribbon width needs clearance, including the sloped edges.
    ribbon(
      [
        [side * 0.282, 0.365, 0.5],
        [side * 0.282, 0.41, 0.475],
        [side * 0.282, 0.475, 0.425],
        [side * 0.273, 0.516, 0.385],
        [side * 0.253, 0.539, 0.36],
        [side * 0.213, 0.544, 0.35],
        [side * 0.175, 0.537, 0.34],
        [side * 0.15, 0.516, 0.33],
        [side * 0.12, 0.481, 0.32],
        [side * 0.023, 0.479, 0.32]
      ],
      0.046,
      red,
      [0, 0, 1]
    );
    const latch = add(new THREE.BoxGeometry(0.046, 0.006, 0.035), steel);
    latch.position.set(side * 0.043, 0.485, 0.32);
  }
  const buckle = add(new THREE.CylinderGeometry(0.029, 0.032, 0.018, 48), plastic, 'Four point cam lock buckle');
  buckle.position.set(0, 0.49, 0.32);
  const buckleFace = add(new THREE.CylinderGeometry(0.024, 0.024, 0.002, 48), steel);
  buckleFace.position.set(0, 0.5, 0.32);
  const lever = add(new THREE.BoxGeometry(0.037, 0.006, 0.008), plastic);
  lever.position.set(0.004, 0.505, 0.32);
  lever.rotation.y = 0.5;

  seat.userData.anchors = {
    seat: new THREE.Vector3(-0.19, 0.92, 0.68),
    harness: new THREE.Vector3(0.105, 0.81, surfaceZ(0.105, 0.81) - 0.065)
  };
  return seat;
}
