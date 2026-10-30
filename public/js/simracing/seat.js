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
  const black = new THREE.MeshPhysicalMaterial({
    color: 0x17181b,
    roughness: 0.94,
    metalness: 0.02,
    sheen: 0.22,
    sheenColor: new THREE.Color(0x66636a),
    sheenRoughness: 0.85,
    bumpMap: weave,
    bumpScale: 0.0007
  });
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: 0x121417,
    roughness: 0.6,
    metalness: 0.08,
    bumpMap: weave,
    bumpScale: 0.00025
  });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.42, metalness: 0.08 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x777d83, roughness: 0.36, metalness: 0.68 });
  const stitching = new THREE.MeshStandardMaterial({ color: 0xa03537, roughness: 0.88 });
  const webbing = canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = x % 16 === 0 ? '#dddddd' : '#b9b9b9';
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.fillStyle = '#5c5c5c';
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
  });
  webbing.colorSpace = THREE.NoColorSpace;
  webbing.wrapS = webbing.wrapT = THREE.RepeatWrapping;
  webbing.repeat.set(1, 1);
  const red = new THREE.MeshPhysicalMaterial({
    color: 0xd0061b,
    roughness: 0.9,
    specularIntensity: 0.25,
    sheen: 0.12,
    sheenColor: new THREE.Color(0x851225),
    sheenRoughness: 0.95,
    metalness: 0,
    bumpMap: webbing,
    bumpScale: 0.00025,
    side: THREE.DoubleSide
  });
  const gradation = canvas(1024, 1536, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#747771');
    gradient.addColorStop(0.5, '#a4a496');
    gradient.addColorStop(1, '#b5ad94');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.font = '900 190px Arial Black, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (let row = -1; row < 8; row++) {
      ctx.fillStyle = row < 3 ? '#40433f' : '#626050';
      for (let col = -1; col < 3; col++) ctx.fillText('BRIDE', col * 620 - 70 + (row % 2) * 24, row * 224 + 90, 590);
    }
    // Fine warp/weft lines keep the lettering embedded in the cloth.
    ctx.fillStyle = 'rgba(20,22,20,.12)';
    for (let x = 0; x < w; x += 3) ctx.fillRect(x, 0, 1, h);
    ctx.fillStyle = 'rgba(235,230,211,.10)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    // The woven grain is also visible in diffuse color, not only in normal light.
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,.055)' : 'rgba(20,22,20,.06)';
      ctx.fillRect(random() * w, random() * h, 1, 3);
    }
  });
  const fabric = new THREE.MeshStandardMaterial({
    color: 0xd9d5c8,
    map: gradation,
    roughness: 0.96,
    bumpMap: weave,
    bumpScale: 0.0007
  });

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

  // Sewn side panels follow the shoulder wings, separate from the piping.
  for (const side of [-1, 1]) {
    const seam = [0.47, 0.58, 0.68, 0.78, 0.85, 0.91, 0.975].map((y) => {
      const x = side * widthAt(y) * 0.76;
      return [x, y, surfaceZ(x, y) - 0.0018];
    });
    path(seam, 0.00075, stitching, 90).name = 'BRIDE shoulder panel stitching';
  }

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
  // A swept bolster has a raised knee end and tapers into the recliner.
  // Its crown stays below the existing lap-belt envelope.
  const bolsterStations = [
    [0.115, 0.216, 0.444, 0, 0],
    [0.14, 0.215, 0.448, 0.044, 0.074],
    [0.2, 0.214, 0.445, 0.055, 0.086],
    [0.32, 0.212, 0.439, 0.055, 0.087],
    [0.4, 0.214, 0.429, 0.054, 0.086],
    [0.49, 0.218, 0.416, 0.052, 0.074],
    [0.555, 0.222, 0.408, 0.039, 0.049],
    [0.578, 0.222, 0.408, 0, 0]
  ];
  const bolsterCentre = new THREE.CatmullRomCurve3(bolsterStations.map(([z, x, y]) => v([x, y, z])));
  const bolsterSize = new THREE.CatmullRomCurve3(bolsterStations.map(([, , , rx, ry]) => v([rx, ry, 0])));
  function bolsterPoint(t, angle) {
    const c = bolsterCentre.getPoint(t),
      r = bolsterSize.getPoint(t);
    return [
      c.x + Math.cos(angle) * Math.max(0, r.x),
      c.y + Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** 0.8 * Math.max(0, r.y),
      c.z
    ];
  }
  const bolsterPositions = [],
    bolsterUvs = [],
    bolsterIndices = [];
  const longitudinal = 72,
    circumference = 32;
  for (let i = 0; i <= longitudinal; i++)
    for (let j = 0; j <= circumference; j++) {
      bolsterPositions.push(...bolsterPoint(i / longitudinal, (j / circumference) * Math.PI * 2));
      bolsterUvs.push(j / circumference, i / longitudinal);
      if (i < longitudinal && j < circumference) {
        const a = i * (circumference + 1) + j,
          b = a + 1,
          c = a + circumference + 1,
          d = c + 1;
        bolsterIndices.push(a, b, c, b, d, c);
      }
    }
  const bolsterGeometry = new THREE.BufferGeometry();
  bolsterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bolsterPositions, 3));
  bolsterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(bolsterUvs, 2));
  bolsterGeometry.setIndex(bolsterIndices);
  bolsterGeometry.computeVertexNormals();
  for (const side of [-1, 1]) {
    const bolster = add(bolsterGeometry, black, 'Tapered BRIDE hip bolster');
    bolster.scale.x = side;
    // Two rows of individual stitches follow the actual curved upholstery.
    const stitches = [];
    for (const angle of [1.07, 1.14])
      for (let i = 4; i < 143; i += 2) {
        for (const t of [i / 150, (i + 1) / 150]) {
          const pt = bolsterPoint(t, angle);
          pt[0] *= side;
          pt[1] += 0.0008;
          stitches.push(...pt);
        }
      }
    const stitchGeometry = new THREE.BufferGeometry();
    stitchGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stitches, 3));
    const sewing = new THREE.LineSegments(stitchGeometry, new THREE.LineBasicMaterial({ color: 0xb94d50 }));
    sewing.name = 'Double red bolster stitching';
    sewing.userData.componentId = 'seat';
    seat.add(sewing);
    // Broad molded recliner cover under the hip bolster, visible in the side photo.
    const coverShape = new THREE.Shape();
    coverShape.moveTo(0.23, 0.331);
    coverShape.lineTo(0.565, 0.331);
    coverShape.quadraticCurveTo(0.583, 0.381, 0.548, 0.433);
    coverShape.quadraticCurveTo(0.511, 0.465, 0.467, 0.427);
    coverShape.lineTo(0.324, 0.388);
    coverShape.quadraticCurveTo(0.26, 0.4, 0.23, 0.367);
    coverShape.closePath();
    const coverGeo = new THREE.ExtrudeGeometry(coverShape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelSize: 0.003,
      bevelThickness: 0.003,
      bevelSegments: 3,
      curveSegments: 16
    });
    coverGeo.translate(0, 0, -0.004);
    const cover = add(coverGeo, plastic, 'BRIDE molded recliner side cover');
    cover.rotation.y = -Math.PI / 2;
    cover.position.x = side * 0.246;
    for (const [z, y] of [
      [0.29, 0.357],
      [0.39, 0.352],
      [0.49, 0.38]
    ]) {
      const screw = add(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), plastic, 'Recliner cover screw');
      screw.rotation.z = Math.PI / 2;
      screw.position.set(side * 0.253, y, z);
    }
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
    ctx.font = 'italic 900 225px Arial Black, Arial, sans-serif';
    ctx.fillText('BRIDE', w / 2, 180, w * 0.96);
    ctx.fillStyle = '#d92c42';
    ctx.font = 'italic bold 90px cursive';
    ctx.fillText('Low', w * 0.46, 318);
    ctx.fillText('Max', w * 0.56, 395);
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
    const curve = new THREE.CatmullRomCurve3(points.map(v));
    const segments = Math.max(100, (points.length - 1) * 12),
      columns = 6,
      stride = columns + 1;
    const positions = [],
      uv = [],
      idx = [];
    const length = curve.getLength();
    const edges = [[], []];
    for (let layer = 0; layer < 2; layer++) {
      const sign = layer === 0 ? 1 : -1;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments,
          p = curve.getPoint(t),
          tangent = curve.getTangent(t);
        const right = v(widthAxis).addScaledVector(tangent, -v(widthAxis).dot(tangent)).normalize();
        const normal = right.clone().cross(tangent).normalize();
        for (let j = 0; j <= columns; j++) {
          const across = (j / columns) * 2 - 1;
          const crown = 0.0007 + 0.00035 * (1 - across * across);
          const pt = p
            .clone()
            .addScaledVector(right, (across * width) / 2)
            .addScaledVector(normal, sign * crown);
          positions.push(...pt.toArray());
          uv.push(j / columns, (t * length) / 0.09);
          if (layer === 0 && (j === 0 || j === columns)) edges[j === 0 ? 0 : 1].push(pt.toArray());
        }
      }
    }
    const offset = (segments + 1) * stride;
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < columns; j++) {
        const a = i * stride + j,
          b = a + 1,
          c = a + stride,
          d = c + 1;
        idx.push(a, b, c, b, d, c, a + offset, c + offset, b + offset, b + offset, c + offset, d + offset);
      }
      for (const j of [0, columns]) {
        const a = i * stride + j,
          b = a + stride;
        idx.push(a, b, a + offset, b, b + offset, a + offset);
      }
    }
    for (const i of [0, segments])
      for (let j = 0; j < columns; j++) {
        const a = i * stride + j,
          b = a + 1;
        idx.push(a, a + offset, b, b, a + offset, b + offset);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(geo, material, 'Thick woven harness webbing');
    // A subtle bound edge gives the webbing a physical silhouette at grazing angles.
    if (width > 0.025) for (const edge of edges) path(edge, 0.00045, material, segments).name = 'Bound harness edge';
    return curve;
  }
  function rearHarnessHook(x) {
    // The close-up shows vertical eye bolts threaded into the TOP of the rear
    // crossmember (Y .195), with silver snap hooks clipped through the black eyes.
    const washer = add(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 24), steel, 'Harness eye washer');
    washer.position.set(x, 0.197, 0.68);
    const nut = add(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 6), plastic, 'Harness eye locking nut');
    nut.position.set(x, 0.202, 0.68);
    const stem = add(new THREE.CylinderGeometry(0.005, 0.005, 0.022, 16), steel, 'Vertical harness eye bolt stem');
    stem.position.set(x, 0.202, 0.68);
    const eye = add(new THREE.TorusGeometry(0.014, 0.004, 10, 32), plastic, 'Harness eye bolt');
    eye.rotation.y = Math.PI / 2;
    eye.position.set(x, 0.222, 0.68);
    path(
      [
        [x - 0.006, 0.231, 0.68],
        [x - 0.012, 0.22, 0.68],
        [x + 0.009, 0.216, 0.68],
        [x + 0.016, 0.238, 0.68],
        [x + 0.011, 0.265, 0.68],
        [x - 0.012, 0.265, 0.68],
        [x - 0.014, 0.242, 0.68]
      ],
      0.004,
      steel,
      40
    ).name = 'Rear harness snap hook';
    path(
      [
        [x - 0.014, 0.242, 0.68],
        [x - 0.006, 0.231, 0.68]
      ],
      0.002,
      steel,
      4
    ).name = 'Snap hook closing gate';
    for (const y of [0.265, 0.289]) {
      const bar = add(new THREE.BoxGeometry(0.058, 0.006, 0.006), steel, 'Harness webbing slot');
      bar.position.set(x, y, 0.68);
    }
    for (const dx of [-0.026, 0.026]) {
      const edge = add(new THREE.BoxGeometry(0.006, 0.024, 0.006), steel, 'Harness webbing slot');
      edge.position.set(x + dx, 0.277, 0.68);
    }
    ribbon(
      [
        [x, 0.335, 0.703],
        [x, 0.312, 0.695],
        [x, 0.29, 0.687],
        [x, 0.289, 0.68],
        [x, 0.298, 0.676]
      ],
      0.045,
      red
    );
    return [x, 0.298, 0.676];
  }
  const omp = textMap(
    (ctx, w, h) => {
      ctx.fillStyle = '#18191b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#585244';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#f5d526';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'italic 900 240px Arial Black, Arial';
      ctx.fillText('OMP', 0, 0, h * 0.85);
    },
    512,
    1024
  );
  for (const side of [-1, 1]) {
    const hx = side * 0.09,
      hy = 1.012,
      hz = surfaceZ(hx, hy);
    const rearAnchor = rearHarnessHook(side * 0.135);
    ribbon(
      [
        rearAnchor,
        [side * 0.135, 0.36, 0.727],
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
      new THREE.PlaneGeometry(0.039, 0.083),
      new THREE.MeshStandardMaterial({ map: omp, roughness: 0.93, side: THREE.DoubleSide }),
      'OMP shoulder pad label'
    );
    patch.position.set(side * 0.105, 0.813, surfaceZ(side * 0.106, 0.81) - 0.074);
    patch.rotation.set(0.29, Math.PI, side * -0.03);
    // Stamped adjuster with open slots, a central roller and folded pull tab.
    const adjuster = new THREE.Group();
    adjuster.position.set(side * 0.101, 0.7, surfaceZ(side * 0.1, 0.7) - 0.078);
    adjuster.rotation.x = 0.28;
    seat.add(adjuster);
    function adjusterBar(w, h, d, x, y, z, material = steel) {
      const bar = add(new THREE.BoxGeometry(w, h, d), material, 'OMP strap adjuster');
      seat.remove(bar);
      adjuster.add(bar);
      bar.position.set(x, y, z);
      return bar;
    }
    for (const y of [-0.014, 0, 0.014]) adjusterBar(0.056, 0.005, 0.008, 0, y, 0);
    for (const x of [-0.026, 0.026]) adjusterBar(0.005, 0.033, 0.008, x, 0, 0);
    adjusterBar(0.028, 0.027, 0.002, 0, -0.029, 0.003, plastic);
    const folded = [
      [side * 0.101, 0.708, surfaceZ(side * 0.1, 0.708) - 0.089],
      [side * 0.101, 0.68, surfaceZ(side * 0.1, 0.68) - 0.087],
      [side * 0.102, 0.641, surfaceZ(side * 0.1, 0.641) - 0.079]
    ];
    ribbon(folded, 0.039, red);
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
  const camShape = new THREE.Shape();
  camShape.moveTo(-0.025, -0.006);
  camShape.lineTo(-0.004, -0.008);
  camShape.quadraticCurveTo(0.019, -0.015, 0.022, -0.003);
  camShape.quadraticCurveTo(0.016, 0.012, 0.004, 0.009);
  camShape.lineTo(-0.023, 0.005);
  camShape.quadraticCurveTo(-0.031, 0.001, -0.025, -0.006);
  const camGeometry = new THREE.ExtrudeGeometry(camShape, {
    depth: 0.003,
    bevelEnabled: true,
    bevelSize: 0.001,
    bevelThickness: 0.001,
    bevelSegments: 2,
    curveSegments: 12
  });
  const cam = add(camGeometry, steel, 'OMP cam lock release lever');
  cam.rotation.x = -Math.PI / 2;
  cam.rotation.z = 0.32;
  cam.position.set(-0.007, 0.504, 0.32);
  const badgeMap = canvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dcc23d';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#242528';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 900 72px Arial';
    ctx.fillText('OMP', w / 2, h / 2, 210);
  });
  const badge = add(
    new THREE.CircleGeometry(0.011, 32),
    new THREE.MeshStandardMaterial({ map: badgeMap, roughness: 0.55 }),
    'OMP buckle badge'
  );
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0.004, 0.51, 0.32);

  seat.userData.anchors = {
    seat: new THREE.Vector3(-0.19, 0.92, 0.68),
    harness: new THREE.Vector3(0.105, 0.81, surfaceZ(0.105, 0.81) - 0.065)
  };
  return seat;
}
