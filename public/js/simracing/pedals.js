/**
 * Original procedural reconstruction from Simucube's product photography.
 * References: docs.simucube.com/{ActivePedal,ActivePedalPro,CoPedal}/Drawings.html
 * and simucube.com product photos APP-1, APU-1, CoPedal_Product_Take1,
 * ACC-BP-1-FRONTRIGHT. No manufacturer CAD is embedded.
 * Metres; +X driver's right, +Y up, +Z toward driver. Placement is approximate.
 */
export function createPedals(THREE) {
  const group = new THREE.Group();
  group.name = 'Simucube three-pedal assembly';
  const anchors = {};
  let componentId = 'pedal-plate';
  const m = {
    shell: new THREE.MeshStandardMaterial({ color: 0x151719, metalness: 0.64, roughness: 0.34 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: 0.75, roughness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x080b0d, metalness: 0.2, roughness: 0.72 }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0x989fa6, metalness: 0.86, roughness: 0.25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd3d9dd, metalness: 0.9, roughness: 0.21 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xee720c, metalness: 0.6, roughness: 0.3 }),
    face: new THREE.MeshStandardMaterial({ color: 0x191c1e, metalness: 0.52, roughness: 0.58 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.92 })
  };
  const unitY = new THREE.Vector3(0, 1, 0);
  function add(geo, mat, xyz, parent) {
    const obj = new THREE.Mesh(geo, mat);
    obj.userData.componentId = componentId;
    obj.position.set(...xyz);
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }
  function box(w, h, d, xyz, mat, parent) {
    return add(new THREE.BoxGeometry(w, h, d), mat, xyz, parent);
  }
  function outline(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }
  function extrude(shape, depth, xyz, mat, parent, bevel = 0.001) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      curveSegments: 8,
      steps: 1
    });
    geo.translate(0, 0, -depth / 2);
    return add(geo, mat, xyz, parent);
  }
  function rounded(w, h, d, xyz, mat, parent, radius = 0.006) {
    return extrude(outline(w, h, Math.min(radius, w / 3, h / 3)), d, xyz, mat, parent);
  }
  function rod(a, b, radius, mat, parent, segments = 16) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const v = end.clone().sub(start);
    const obj = add(
      new THREE.CylinderGeometry(radius, radius, v.length(), segments),
      mat,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      parent
    );
    obj.quaternion.setFromUnitVectors(unitY, v.normalize());
    return obj;
  }
  function screw(xyz, parent, side = false, radius = 0.004) {
    const v = new THREE.Vector3(...xyz);
    const d = side ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const head = rod(
      v.clone().addScaledVector(d, -0.002).toArray(),
      v.clone().addScaledVector(d, 0.002).toArray(),
      radius,
      m.steel,
      parent,
      16
    );
    rod(
      v.clone().addScaledVector(d, 0.0021).toArray(),
      v.clone().addScaledVector(d, 0.0023).toArray(),
      radius * 0.5,
      m.dark,
      parent,
      6
    );
    return head;
  }
  function slot(w, h, x, y) {
    const p = new THREE.Path();
    const r = h / 2;
    p.moveTo(x - w / 2 + r, y - r);
    p.lineTo(x + w / 2 - r, y - r);
    p.absarc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2, false);
    p.lineTo(x - w / 2 + r, y + r);
    p.absarc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5, false);
    return p;
  }
  function plate(w, depth, xyz, parent) {
    const s = outline(w, depth, 0.005);
    for (const x of [-w / 2 + 0.012, w / 2 - 0.012]) {
      for (const z of [-depth * 0.34, 0, depth * 0.34]) {
        const hole = slot(0.047, 0.007, z, x);
        // Plate lies in XZ; the slots are lengthwise along the pedal.
        const turned = new THREE.Path();
        for (const [i, p] of hole.getPoints(20).entries()) {
          if (i === 0) turned.moveTo(p.y, p.x);
          else turned.lineTo(p.y, p.x);
        }
        s.holes.push(turned);
      }
    }
    const o = extrude(s, 0.009, xyz, m.shell, parent, 0.0006);
    o.rotation.x = -Math.PI / 2;
    return o;
  }
  function brand(text, w, h, xyz, parent, rotation = [0, 0, 0], color = '#d8dcde') {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1024, 128);
    ctx.fillStyle = color;
    ctx.font = '500 76px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Extra spacing reproduces the small industrial wordmark's proportions.
    ctx.fillText(text.split('').join(' '), 512, 68, 990);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
    const o = add(new THREE.PlaneGeometry(w, h), mat, xyz, parent);
    o.rotation.set(...rotation);
    o.castShadow = false;
  }
  function cable(points, r, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 28, r, 7, false), m.rubber, [0, 0, 0], parent);
  }

  // Simucube Baseplate: three 360mm mounting extrusions, narrow heel support,
  // two bolted side plates and independently tilted heel rest (not a solid tray).
  const tray = new THREE.Group();
  tray.position.set(0, 0.405, -0.6);
  tray.rotation.x = -0.07;
  group.add(tray);
  tray.updateWorldMatrix(true, false);
  // The owner's Baseplate sits on four SIMART height-adjustment brackets,
  // above the MS120 rails. These supports stay fixed while the tray is tilted.
  componentId = 'pedal-mount';
  for (const z of [-0.19, 0.13]) {
    const top = tray.localToWorld(new THREE.Vector3(0, -0.032, z));
    box(0.55, 0.035, 0.04, [0, top.y, top.z], m.shell, group).name = 'Pedal mount transverse adapter';
    for (const side of [-1, 1]) {
      const x = side * 0.27;
      box(0.055, 0.006, 0.09, [side * 0.29, 0.218, top.z + 0.018], m.shell, group);
      for (const dz of [-0.014, 0.05]) screw([side * 0.29, 0.223, top.z + dz], group);
      const upright = new THREE.Shape();
      [
        [top.z - 0.025, 0.221],
        [top.z + 0.047, 0.221],
        [top.z + 0.025, top.y + 0.036],
        [top.z - 0.024, top.y + 0.036]
      ].forEach(([zz, y], i) => (i ? upright.lineTo(zz, y) : upright.moveTo(zz, y)));
      upright.closePath();
      for (let y = 0.245; y < top.y + 0.025; y += 0.017) {
        const hole = new THREE.Path();
        hole.absarc(top.z, y, 0.0036, 0, Math.PI * 2, true);
        upright.holes.push(hole);
      }
      const cheek = extrude(upright, 0.006, [x, 0, 0], m.shell, group, 0.0006);
      cheek.rotation.y = -Math.PI / 2;
      cheek.name = 'SIMART perforated height-adjustment bracket';
      screw([x + side * 0.005, top.y, top.z], group, true, 0.006);
      // Bolted top adapter connects the wider cockpit to the narrower Baseplate.
      for (const xx of [side * 0.17, side * 0.25]) screw([xx, top.y + 0.021, top.z], group);
    }
  }
  componentId = 'pedal-plate';
  for (const z of [-0.23, -0.065, 0.1]) {
    box(0.36, 0.028, 0.065, [0, 0, z], m.shell, tray);
    for (const zz of [-0.019, 0.019]) {
      box(0.355, 0.0012, 0.006, [0, 0.0148, z + zz], m.dark, tray);
      box(0.355, 0.001, 0.001, [0, 0.0155, z + zz + 0.004], m.edge, tray);
    }
  }
  box(0.36, 0.028, 0.025, [0, 0, 0.25], m.shell, tray);
  for (const x of [-0.187, 0.187]) {
    const s = new THREE.Shape();
    [
      [-0.28, -0.025],
      [-0.28, 0.035],
      [0.1, 0.035],
      [0.27, 0.065],
      [0.285, 0.04],
      [0.285, -0.025]
    ].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
    s.closePath();
    for (const z of [-0.23, -0.065, 0.1, 0.24]) s.holes.push(slot(0.025, 0.007, z, -0.008));
    const side = extrude(s, 0.006, [x, 0, 0], m.shell, tray);
    side.rotation.y = -Math.PI / 2;
    for (const z of [-0.25, -0.21, -0.085, -0.045, 0.08, 0.12, 0.25])
      screw([x + Math.sign(x) * 0.005, 0, z], tray, true);
  }
  componentId = 'pedal-plate';
  const heel = rounded(0.354, 0.13, 0.004, [0, 0.041, 0.2], m.face, tray, 0.004);
  heel.rotation.x = -Math.PI / 2 + 0.13;
  const lip = box(0.354, 0.035, 0.004, [0, 0.066, 0.135], m.shell, tray);
  lip.rotation.x = 0.3;
  brand('SIMUCUBE', 0.17, 0.02, [0, 0.068, 0.14], tray, [0.3, 0, 0]);
  for (const x of [-0.16, 0.16]) screw([x, 0.055, 0.235], tray);

  function motorBody(p, length, ultimate) {
    plate(0.1, length, [0, 0.022, 0], p);
    // The Ultimate exposes its front actuator; Pro has the long enclosed housing.
    const bodyLength = ultimate ? 0.24 : length - 0.018;
    const bodyZ = ultimate ? -0.075 : -0.003;
    const frontZ = ultimate ? 0.047 : length / 2 - 0.006;
    let body;
    if (ultimate) {
      body = box(0.087, 0.007, bodyLength, [0, 0.028, bodyZ], m.shell, p);
      for (const x of [-0.041, 0.041]) box(0.005, 0.087, bodyLength, [x, 0.074, bodyZ], m.shell, p);
      // Real opening in the top cover with a recessed sensor board, not a decal.
      const lidShape = outline(0.082, bodyLength - 0.006, 0.005);
      const window = outline(0.038, 0.042, 0.002);
      const cutout = new THREE.Path();
      window.getPoints(12).forEach((v, i) => (i ? cutout.lineTo(v.x, v.y + 0.036) : cutout.moveTo(v.x, v.y + 0.036)));
      lidShape.holes.push(cutout);
      const lid = extrude(lidShape, 0.002, [0, 0.118, bodyZ], m.shell, p, 0.0004);
      lid.rotation.x = Math.PI / 2;
      const pcb = new THREE.MeshStandardMaterial({ color: 0x2c5b48, roughness: 0.8 });
      box(0.037, 0.001, 0.04, [0, 0.108, -0.111], pcb, p);
      box(0.014, 0.004, 0.017, [0, 0.111, -0.111], m.dark, p);
      for (const x of [-0.014, 0.014]) screw([x, 0.111, -0.126], p, false, 0.002);
      rounded(0.066, 0.066, 0.083, [0, 0.066, 0.093], m.shell, p, 0.008);
      rounded(0.086, 0.089, 0.034, [0, 0.07, 0.156], m.shell, p, 0.008);
      for (const x of [-0.033, 0.033]) rod([x, 0.063, 0.049], [x, 0.063, 0.151], 0.0035, m.steel, p);
      const status = new THREE.MeshStandardMaterial({ color: 0x6be698, emissive: 0x22cb6b, emissiveIntensity: 0.8 });
      for (const z of [-0.065, -0.078]) rod([-0.043, 0.084, z], [-0.045, 0.084, z], 0.002, status, p);
    } else {
      body = rounded(0.087, 0.092, bodyLength, [0, 0.071, bodyZ], m.shell, p, 0.008);
      box(0.072, 0.002, bodyLength - 0.02, [0, 0.118, bodyZ], m.shell, p);
    }
    for (const z of [-length / 2 + 0.003, frontZ]) {
      rounded(0.089, 0.094, 0.005, [0, 0.071, z], m.edge, p, 0.008);
      for (const x of [-0.034, 0.034]) {
        const capbolt = rod([x, 0.037, z - 0.003], [x, 0.037, z + 0.003], 0.0028, m.steel, p, 12);
        capbolt.name = 'End cap fastener';
      }
    }
    for (const x of [-0.0444, 0.0444]) {
      box(0.001, 0.002, bodyLength - 0.01, [x, 0.064, bodyZ], m.orange, p);
      brand('SIMUCUBE', ultimate ? 0.13 : 0.17, 0.014, [x * 1.015, 0.085, ultimate ? -0.08 : -0.033], p, [
        0,
        (Math.sign(x) * Math.PI) / 2,
        0
      ]);
      for (const z of [-length * 0.33, 0, length * 0.33]) screw([x * 1.03, 0.043, z], p, true, 0.0027);
    }
    if (ultimate) {
      // Ultimate's split front housing and orange collar are recognizable in the photo.
      box(0.091, 0.096, 0.009, [0, 0.071, 0.046], m.orange, p);
      box(0.095, 0.0015, 0.012, [0, 0.12, 0.046], m.aluminum, p);
    } else {
      box(0.052, 0.0018, 0.022, [0, 0.12, -0.139], m.dark, p);
    }
    // Electrical connectors stay at the far/motor end with bundled cables.
    const z = -length / 2 - 0.008;
    box(0.019, 0.014, 0.009, [-0.022, 0.054, z], m.dark, p);
    rod([0.024, 0.052, z - 0.006], [0.024, 0.052, z + 0.003], 0.006, m.edge, p);
    cable(
      [
        [0.024, 0.052, z - 0.01],
        [0.04, 0.045, z - 0.028],
        [0.055, 0.012, z - 0.035],
        [0.06, 0.006, z + 0.09]
      ],
      0.0025,
      p
    );
    return body;
  }
  function fork(p, pivotZ, topZ, topY, width = 0.077) {
    // Two solid side cheeks joined at the foot, surrounding the front of the housing.
    for (const side of [-1, 1]) {
      const s = new THREE.Shape();
      [
        [pivotZ + 0.015, 0.035],
        [pivotZ - 0.008, 0.035],
        [pivotZ - 0.023, 0.117],
        [topZ - 0.018, topY - 0.016],
        [topZ - 0.012, topY + 0.007],
        [topZ + 0.012, topY + 0.003],
        [pivotZ + 0.003, 0.111]
      ].forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
      s.closePath();
      const cheek = extrude(s, 0.008, [(side * width) / 2, 0, 0], m.edge, p, 0.0015);
      cheek.rotation.y = -Math.PI / 2;
      rod([side * (width / 2 - 0.006), 0.041, pivotZ], [side * (width / 2 + 0.008), 0.041, pivotZ], 0.012, m.shell, p);
      screw([side * (width / 2 + 0.01), 0.041, pivotZ], p, true, 0.006);
    }
    rod([-width / 2, topY - 0.02, topZ], [width / 2, topY - 0.02, topZ], 0.007, m.steel, p);
  }
  function face(p, { x = 0, y, z, w, h, perforated = false, tilt = -0.13 }) {
    const faceGroup = new THREE.Group();
    faceGroup.position.set(x, y, z);
    faceGroup.rotation.x = tilt;
    p.add(faceGroup);
    const shape = outline(w, h, 0.009);
    if (perforated) {
      for (let xx = -w / 2 + 0.009; xx < w / 2 - 0.006; xx += 0.009) {
        for (let yy = -h / 2 + 0.011; yy < h / 2 - 0.008; yy += 0.01) {
          const hole = new THREE.Path();
          hole.absarc(xx, yy, 0.0033, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
      }
    }
    extrude(shape, 0.006, [0, 0, 0], m.face, faceGroup, 0.0006);
    // Anodised bevel catches the studio lighting around the plate.
    const border = new THREE.EdgesGeometry(
      new THREE.ExtrudeGeometry(outline(w, h, 0.009), { depth: 0.006, bevelEnabled: false, curveSegments: 8 })
    );
    border.translate(0, 0, -0.003);
    const line = new THREE.LineSegments(border, new THREE.LineBasicMaterial({ color: 0x7b8086 }));
    faceGroup.add(line);
    if (!perforated) {
      brand('SIMUCUBE', w * 0.78, 0.008, [0, -0.013, 0.004], faceGroup);
      const marque = new THREE.Shape();
      [
        [-0.011, -0.006],
        [-0.011, 0.006],
        [0, 0.012],
        [0.011, 0.006],
        [0.011, -0.006],
        [0, -0.012]
      ].forEach(([x, y], i) => (i ? marque.lineTo(x, y) : marque.moveTo(x, y)));
      marque.closePath();
      const inset = new THREE.Path();
      [
        [-0.008, -0.004],
        [-0.008, 0.004],
        [0, 0.008],
        [0.008, 0.004],
        [0.008, -0.004],
        [0, -0.008]
      ].forEach(([x, y], i) => (i ? inset.lineTo(x, y) : inset.moveTo(x, y)));
      inset.closePath();
      marque.holes.push(inset);
      extrude(marque, 0.0002, [0, 0.012, 0.0037], m.aluminum, faceGroup, 0);
    }
    // Slotted rear carrier bridges the foot plate to the pivot shaft.
    const carrier = outline(0.03, Math.min(0.084, h - 0.025), 0.004);
    const carrierSlot = new THREE.Path();
    slot(0.05, 0.007, 0, 0)
      .getPoints(16)
      .forEach((point, i) => (i ? carrierSlot.lineTo(-point.y, point.x) : carrierSlot.moveTo(-point.y, point.x)));
    carrier.holes.push(carrierSlot);
    extrude(carrier, 0.005, [0, -0.009, -0.016], m.shell, faceGroup, 0.0006);
    for (const yy of [-0.025, 0.025]) {
      const bolt = rod([0, yy, -0.022], [0, yy, -0.004], 0.003, m.steel, faceGroup);
      bolt.name = 'Pedal face adjustment fastener';
      const washer = add(new THREE.TorusGeometry(0.0043, 0.001, 8, 20), m.steel, [0, yy, -0.02], faceGroup);
      washer.name = 'Pedal face carrier washer';
    }
    box(0.026, 0.018, 0.014, [0, -0.02, -0.023], m.shell, faceGroup);
    return faceGroup;
  }
  function active(x, ultimate, id) {
    componentId = id;
    const p = new THREE.Group();
    p.name = ultimate ? 'ActivePedal Ultimate' : 'ActivePedal Pro';
    p.position.set(x, 0.015, -0.045);
    tray.add(p);
    const length = ultimate ? 0.4 : 0.418;
    motorBody(p, length, ultimate);
    fork(p, 0.174, 0.122, 0.214);
    // Long horizontal actuator link above the body; orange fork on Ultimate,
    // twin dark slotted rails on Pro, not a diagonal pushrod/spring pedal.
    const linkage = new THREE.Group();
    linkage.position.set(0, 0.185, 0.015);
    p.add(linkage);
    for (const xx of [-0.019, 0.019]) {
      const s = outline(0.23, 0.024, 0.009);
      s.holes.push(slot(0.078, 0.011, -0.056, 0));
      s.holes.push(slot(0.078, 0.011, 0.056, 0));
      const side = extrude(s, 0.007, [xx, 0, 0], ultimate ? m.orange : m.edge, linkage, 0.001);
      side.rotation.y = -Math.PI / 2;
    }
    for (const zz of [-0.109, 0.109]) {
      rod([-0.027, 0, zz], [0.027, 0, zz], 0.009, m.shell, linkage);
      for (const side of [-1, 1]) {
        const bearing = add(new THREE.TorusGeometry(0.0073, 0.0017, 8, 24), m.aluminum, [side * 0.027, 0, zz], linkage);
        bearing.rotation.y = Math.PI / 2;
        bearing.name = 'Actuator clevis bearing';
        screw([side * 0.03, 0, zz], linkage, true, 0.0048);
      }
    }
    box(0.039, 0.022, 0.027, [0, 0, 0], ultimate ? m.aluminum : m.shell, linkage);
    if (!ultimate) {
      for (const x of [-0.019, 0.019]) box(0.002, 0.0012, 0.19, [x, 0.013, 0], m.aluminum, linkage);
    }
    if (ultimate) {
      for (const xx of [-0.009, 0.009]) box(0.006, 0.001, 0.016, [xx, 0.012, 0], m.dark, linkage);
      cable(
        [
          [0, 0.2, 0.01],
          [0, 0.232, -0.018],
          [0, 0.223, -0.075],
          [0, 0.185, -0.1]
        ],
        0.0017,
        p
      );
    }
    // Actuator's rear clevis with two cheeks and a visible pin.
    for (const xx of [-0.024, 0.024]) rounded(0.008, 0.043, 0.028, [xx, 0.155, -0.098], m.shell, p, 0.003);
    rod([-0.031, 0.176, -0.098], [0.031, 0.176, -0.098], 0.007, m.steel, p);
    face(p, { y: 0.214, z: 0.145, w: 0.077, h: ultimate ? 0.116 : 0.122 });
    anchors[id] = tray.localToWorld(new THREE.Vector3(x, 0.255, 0.105));
  }
  function coPedal() {
    componentId = 'co-pedal';
    const p = new THREE.Group();
    p.name = 'Simucube Co-Pedal clutch';
    p.position.set(-0.12, 0.015, -0.012);
    tray.add(p);
    plate(0.094, 0.278, [0, 0.022, -0.018], p);
    rounded(0.071, 0.073, 0.148, [0, 0.066, -0.073], m.shell, p, 0.006);
    // Open cast side brackets with genuine adjustment slots and pairs of fasteners.
    for (const x of [-0.037, 0.037]) {
      const s = outline(0.188, 0.075, 0.009);
      s.holes.push(slot(0.066, 0.012, -0.011, 0.012));
      const cheek = extrude(s, 0.006, [x, 0.06, 0.014], m.shell, p, 0.001);
      cheek.rotation.y = -Math.PI / 2;
      for (const z of [-0.04, 0.035, 0.088]) screw([x + Math.sign(x) * 0.005, 0.047, z], p, true, 0.0046);
    }
    fork(p, 0.113, 0.084, 0.188, 0.065);
    // Short spring/damper cartridge, partly exposed between the front cheeks.
    const a = [0, 0.071, -0.075],
      b = [0, 0.151, 0.077];
    rod(a, b, 0.008, m.steel, p);
    rod([0, 0.077, -0.062], [0, 0.111, 0.004], 0.018, m.shell, p);
    const axis = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize();
    const spring = new THREE.Group();
    spring.position.set(0, 0.09, -0.038);
    p.add(spring);
    spring.quaternion.setFromUnitVectors(unitY, axis);
    const coil = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      const angle = t * Math.PI * 18;
      coil.push(new THREE.Vector3(Math.cos(angle) * 0.012, t * 0.07, Math.sin(angle) * 0.012));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 160, 0.0014, 5, false), m.steel, [0, 0, 0], spring);
    rod([0, 0.064, -0.163], [0, 0.064, -0.145], 0.012, m.edge, p);
    for (const x of [-0.037, 0.037])
      brand('SIMUCUBE', 0.095, 0.013, [x * 1.025, 0.078, -0.081], p, [0, (Math.sign(x) * Math.PI) / 2, 0]);
    face(p, { y: 0.19, z: 0.106, w: 0.058, h: 0.173, tilt: -0.16 });
    anchors['co-pedal'] = tray.localToWorld(new THREE.Vector3(-0.12, 0.25, 0.11));
  }
  active(0.12, false, 'active-pro');
  active(0, true, 'active-ultimate');
  coPedal();
  anchors['pedal-plate'] = tray.localToWorld(new THREE.Vector3(0.17, 0.07, 0.23));
  anchors['pedal-mount'] = new THREE.Vector3(-0.28, 0.31, -0.47);
  return { group, anchors };
}
