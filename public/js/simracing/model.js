import { createSeat } from './seat.js';
import { createPedals } from './pedals.js';
import { createWheel } from './wheels.js';
import { createHeadset } from './headset.js';
import { wheelArrangement } from './configuration.js';
import { componentMeshes } from './selection.js';
/**
 * Original, reference-based geometry. Dimensions and placement are approximate;
 * these meshes are not manufacturer CAD or an engineering assembly.
 * Metres; X = driver's right, Y = up, -Z = pedals/front.
 */
export function createCockpit(THREE, initialWheel = 'gt-neo') {
  const group = new THREE.Group();
  group.name = 'Skyfire cockpit';
  const anchors = {};
  let componentId = 'frame';
  const palette = {
    aluminum: new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.66, roughness: 0.36 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x373b40, metalness: 0.62, roughness: 0.32 }),
    groove: new THREE.MeshStandardMaterial({ color: 0x0b0e12, metalness: 0.25, roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141619, metalness: 0.22, roughness: 0.52 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.94 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xbac0c5, metalness: 0.6, roughness: 0.38 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xef751b, metalness: 0.42, roughness: 0.4 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd51d30, roughness: 0.56 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe5e5e1, roughness: 0.65 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x146cab, roughness: 0.48, metalness: 0.25 })
  };
  const assign = (id, x, y, z) => {
    anchors[id] = new THREE.Vector3(x, y, z);
  };
  function mesh(geometry, material, position, parent = group) {
    const m = new THREE.Mesh(geometry, material);
    m.userData.componentId = componentId;
    if (position) m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, x, y, z, material = palette.black, parent = group) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, [x, y, z], parent);
  }
  function rounded(w, h, d, x, y, z, material = palette.black, parent = group, radius = 0.012) {
    const r = Math.min(radius, w / 3, h / 3);
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
    const geom = new THREE.ExtrudeGeometry(s, {
      depth: d,
      bevelEnabled: true,
      bevelSize: Math.min(0.003, d * 0.2),
      bevelThickness: Math.min(0.003, d * 0.2),
      bevelSegments: 2,
      curveSegments: 8
    });
    geom.translate(0, 0, -d / 2);
    const uv = geom.attributes.uv,
      pos = geom.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
    return mesh(geom, material, [x, y, z], parent);
  }
  function rod(a, b, radius, material = palette.silver, parent = group, segments = 16) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const m = mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), segments),
      material,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      parent
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return m;
  }
  function beam(a, b, width, thickness, parent = group) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const m = mesh(
      new THREE.BoxGeometry(width, direction.length(), thickness),
      palette.black,
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      parent
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return m;
  }
  function support(name) {
    const object = new THREE.Group();
    object.name = name;
    group.add(object);
    return object;
  }
  function pivot(x, y, z, parent) {
    rod([x, y - 0.013, z], [x, y + 0.013, z], 0.026, palette.edge, parent);
    bolt(x, y + 0.016, z, parent);
  }
  // Cut plate links and transverse hand knobs, matching the photographed mounts.
  function slottedPlate(a, b, width, thickness, normal, parent) {
    const start = new THREE.Vector3(...a),
      direction = new THREE.Vector3(...b).sub(start),
      length = direction.length(),
      radius = width / 2;
    direction.normalize();
    const face = new THREE.Vector3(...normal)
      .addScaledVector(direction, -new THREE.Vector3(...normal).dot(direction))
      .normalize();
    const across = face.clone().cross(direction);
    const shape = new THREE.Shape();
    shape.moveTo(0, -radius);
    shape.lineTo(length, -radius);
    shape.absarc(length, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(0, radius);
    shape.absarc(0, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
    for (const x of [0, length]) {
      const hole = new THREE.Path();
      hole.absarc(x, 0, 0.0035, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const slotRadius = Math.min(0.006, width * 0.15),
      slotStart = 0.018,
      slotEnd = length - 0.018;
    if (slotEnd > slotStart + 0.008) {
      const slot = new THREE.Path();
      slot.moveTo(slotStart, slotRadius);
      slot.lineTo(slotEnd, slotRadius);
      slot.absarc(slotEnd, 0, slotRadius, Math.PI / 2, -Math.PI / 2, true);
      slot.lineTo(slotStart, -slotRadius);
      slot.absarc(slotStart, 0, slotRadius, -Math.PI / 2, -Math.PI * 1.5, true);
      shape.holes.push(slot);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSize: 0.0005,
      bevelThickness: 0.0005,
      bevelSegments: 1,
      curveSegments: 12
    });
    geometry.translate(0, 0, -thickness / 2);
    const plate = mesh(geometry, palette.black, a, parent);
    plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(direction, across, face));
    plate.name = 'Slotted mounting plate';
    return plate;
  }
  function crossHinge(point, width, parent) {
    const [x, y, z] = point;
    rod([x - width / 2, y, z], [x + width / 2, y, z], 0.008, palette.silver, parent);
    for (const side of [-1, 1]) {
      const xx = x + side * (width / 2 - 0.004);
      rod([xx - 0.003, y, z], [xx + 0.003, y, z], 0.013, palette.edge, parent);
    }
    const knobX = x + Math.sign(x) * (width / 2 + 0.006);
    rod([knobX - 0.006, y, z], [knobX + 0.006, y, z], 0.017, palette.rubber, parent, 32);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      rod(
        [knobX - 0.005, y + 0.017 * Math.cos(angle), z + 0.017 * Math.sin(angle)],
        [knobX + 0.005, y + 0.017 * Math.cos(angle), z + 0.017 * Math.sin(angle)],
        0.0013,
        palette.edge,
        parent,
        6
      );
    }
  }
  // Low dogleg plate and a compact camera tilt head, visible in the close-ups.
  // The device pose drives its support so the backplate cannot float away.
  function cameraMount(device, localJoint, side, parent) {
    device.updateWorldMatrix(true, false);
    const joint = device.localToWorld(new THREE.Vector3(...localJoint));
    const baseY = joint.y - 0.035;
    const z = joint.z;
    const shape = new THREE.Shape();
    [
      [side * 0.313, -0.255],
      [side * 0.351, -0.255],
      [joint.x - side * 0.029, z - 0.035],
      [joint.x + side * 0.029, z - 0.035],
      [joint.x + side * 0.029, z + 0.035],
      [joint.x - side * 0.023, z + 0.035],
      [side * 0.344, -0.185],
      [side * 0.313, -0.185]
    ].forEach(([x, zz], i) => (i ? shape.lineTo(x, zz) : shape.moveTo(x, zz)));
    shape.closePath();
    for (const zz of [z - 0.024, z + 0.024]) {
      const hole = new THREE.Path();
      hole.absarc(joint.x, zz, 0.004, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.006,
      bevelEnabled: true,
      bevelSize: 0.0006,
      bevelThickness: 0.0006,
      bevelSegments: 1,
      curveSegments: 8
    });
    geo.translate(0, 0, -0.003);
    const plate = mesh(geo, palette.black, [0, baseY, 0], parent);
    plate.rotation.x = Math.PI / 2;
    plate.name = 'DIMSIM offset mounting plate';
    box(0.009, 0.08, 0.084, side * 0.315, baseY - 0.037, -0.22, palette.black, parent);
    for (const zz of [-0.247, -0.193]) {
      bolt(side * 0.322, baseY - 0.045, zz, parent, 'side');
      bolt(side * 0.336, baseY + 0.005, zz, parent);
    }
    rod([joint.x, baseY + 0.004, z], [joint.x, baseY + 0.016, z], 0.026, palette.edge, parent, 32);
    // Short fork and transverse tilt lock, not a long pair of articulated arms.
    for (const s of [-1, 1]) box(0.006, 0.025, 0.037, joint.x + s * 0.025, baseY + 0.024, z, palette.black, parent);
    crossHinge(joint.toArray(), 0.064, parent);
    box(0.036, 0.022, 0.032, joint.x, joint.y, z, palette.edge, parent);
    rounded(0.052, 0.064, 0.006, 0, localJoint[1], localJoint[2] + 0.005, palette.black, device, 0.003);
    for (const x of [-0.016, 0.016])
      for (const y of [-0.019, 0.019]) {
        const b = bolt(x, localJoint[1] + y, localJoint[2] + 0.0005, device, 'front');
        b.rotation.x = -Math.PI / 2;
      }
    return joint;
  }
  function tube(points, radius, material, parent = group) {
    const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(path, 32, radius, 8, false), material, null, parent);
  }
  const boltGeometry = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, -0.002),
      new THREE.Vector2(0.008, -0.002),
      new THREE.Vector2(0.008, -0.0008),
      new THREE.Vector2(0.0063, -0.0008),
      new THREE.Vector2(0.0063, 0.0025),
      new THREE.Vector2(0.0055, 0.0032),
      new THREE.Vector2(0, 0.0032)
    ],
    16
  );
  const socketGeometry = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0004, 6);
  function bolt(x, y, z, parent = group, face = 'top') {
    const head = mesh(boltGeometry, palette.silver, [x, y, z], parent);
    if (face === 'front') head.rotation.x = Math.PI / 2;
    if (face === 'side') head.rotation.z = (-Math.sign(x || 1) * Math.PI) / 2;
    mesh(socketGeometry, palette.groove, [0, 0.0033, 0], head).name = 'Recessed hex socket';
    head.name = 'Socket bolt and washer';
    return head;
  }
  function textTexture(text, bg, fg, width = 1024, height = 256) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = fg;
    ctx.font = `600 ${Math.floor(height * 0.48)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2, width * 0.9);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }
  function label(text, w, h, x, y, z, parent = group, bg = '#1b1f24', fg = '#e5e6e5') {
    const material = new THREE.MeshStandardMaterial({ map: textTexture(text, bg, fg), roughness: 0.66 });
    return mesh(new THREE.PlaneGeometry(w, h), material, [x, y, z], parent);
  }
  function profile(length, depth, axis, x, y, z) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    group.add(p);
    // Local length runs along Z, grooves are real inset strips on every visible face.
    box(0.04, depth, length, 0, 0, 0, palette.aluminum, p);
    const slots = Math.max(1, Math.round(depth / 0.04));
    for (const side of [-1, 1]) {
      for (let i = 0; i < slots; i++) {
        box(0.0012, 0.007, length - 0.006, side * 0.0207, (i - (slots - 1) / 2) * 0.04, 0, palette.groove, p);
        box(0.0014, 0.001, length - 0.008, side * 0.021, (i - (slots - 1) / 2) * 0.04 + 0.004, 0, palette.edge, p);
      }
      box(0.007, 0.001, length - 0.006, 0, side * (depth / 2 + 0.0005), 0, palette.groove, p);
    }
    box(0.041, depth + 0.001, 0.004, 0, 0, length / 2, palette.rubber, p);
    box(0.041, depth + 0.001, 0.004, 0, 0, -length / 2, palette.rubber, p);
    if (axis === 'x') p.rotation.y = Math.PI / 2;
    if (axis === 'y') p.rotation.x = Math.PI / 2;
    return p;
  }

  // MS120: low parallel 40 x 120 rails, crossmembers and adjustable wheel uprights.
  for (const x of [-0.29, 0.29]) {
    profile(1.56, 0.12, 'z', x, 0.155, -0.04);
    box(0.0015, 0.003, 1.51, x + Math.sign(x) * 0.021, 0.195, -0.04, palette.red).name = 'Red profile slot inlay';
    for (const z of [-0.71, 0.6]) {
      box(0.055, 0.005, 0.062, x, 0.092, z, palette.silver);
      rod([x, 0.064, z], [x, 0.09, z], 0.017, palette.silver);
      for (const s of [-1, 1]) {
        const fork = box(0.003, 0.04, 0.028, x + s * 0.014, 0.052, z + 0.008, palette.silver);
        fork.rotation.x = -0.28;
      }
      const tire = rod([x - 0.012, 0.032, z + 0.015], [x + 0.012, 0.032, z + 0.015], 0.03, palette.rubber, group, 32);
      tire.name = 'MS120 swivel caster';
      rod([x - 0.016, 0.032, z + 0.015], [x + 0.016, 0.032, z + 0.015], 0.012, palette.silver);
      box(0.023, 0.004, 0.03, x, 0.064, z + 0.038, palette.black);
      for (const dz of [-0.021, 0.021]) bolt(x, 0.218, z + dz);
    }
    profile(0.63, 0.12, 'y', x, 0.51, -0.22);
    box(0.009, 0.15, 0.17, x + Math.sign(x) * 0.025, 0.265, -0.22, palette.black);
    for (const y of [0.23, 0.29]) for (const z of [-0.27, -0.17]) bolt(x + Math.sign(x) * 0.031, y, z, group, 'side');
  }
  for (const z of [-0.77, -0.46, 0.35, 0.68]) profile(0.56, 0.08, 'x', 0, 0.155, z);
  profile(0.6, 0.08, 'x', 0, 0.8, -0.22);
  rounded(0.555, 0.092, 0.006, 0, 0.153, 0.707, palette.black, group, 0.004);
  label('M A X S I M', 0.51, 0.085, 0, 0.153, 0.711, group, '#141619', '#d82330');
  box(0.535, 0.0015, 0.001, 0, 0.194, 0.712, palette.red);
  assign('frame', -0.31, 0.22, 0.6);

  const pedals = createPedals(THREE);
  group.add(pedals.group);
  Object.assign(anchors, pedals.anchors);

  // Nested steel seat runners, latch rack and the U-shaped adjustment handle.
  for (const x of [-0.18, 0.18]) {
    profile(0.48, 0.04, 'z', x, 0.24, 0.43);
    box(0.037, 0.008, 0.4, x, 0.267, 0.44, palette.edge);
    for (const side of [-1, 1]) box(0.004, 0.024, 0.4, x + side * 0.018, 0.279, 0.44, palette.black);
    box(0.026, 0.016, 0.37, x, 0.29, 0.44, palette.black);
    for (let i = 0; i < 12; i++) box(0.004, 0.005, 0.008, x + 0.019, 0.282, 0.28 + i * 0.026, palette.groove);
    for (const z of [0.3, 0.58]) bolt(x, 0.305, z);
  }
  tube(
    [
      [-0.16, 0.286, 0.3],
      [-0.16, 0.302, 0.115],
      [-0.11, 0.313, 0.083],
      [0.11, 0.313, 0.083],
      [0.16, 0.302, 0.115],
      [0.16, 0.286, 0.3]
    ],
    0.005,
    palette.black
  ).name = 'Seat slider release handle';
  const seat = createSeat(THREE);
  group.add(seat);
  assign('seat', -0.23, 1.05, 0.65);
  assign('harness', -0.11, 0.84, 0.48);

  componentId = 'wheelbase';
  // Direct-drive base and QR, with the steering wheel facing the driver (+Z).
  const base = new THREE.Group();
  base.position.set(0, 0.835, -0.27);
  group.add(base);
  const housing = new THREE.Shape();
  [
    [-0.081, -0.073],
    [-0.081, 0.057],
    [-0.066, 0.078],
    [0.066, 0.078],
    [0.081, 0.057],
    [0.081, -0.073],
    [0.065, -0.081],
    [-0.065, -0.081]
  ].forEach(([x, y], i) => (i ? housing.lineTo(x, y) : housing.moveTo(x, y)));
  housing.closePath();
  const housingGeometry = new THREE.ExtrudeGeometry(housing, {
    depth: 0.303,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 3,
    steps: 1
  });
  housingGeometry.translate(0, 0, -0.1515);
  mesh(housingGeometry, palette.aluminum, [0, 0, 0], base).name = 'Faceted Simucube motor housing';
  rounded(0.13, 0.002, 0.283, 0, 0.08, -0.003, palette.edge, base, 0.001);
  rounded(0.145, 0.143, 0.009, 0, 0, 0.153, palette.black, base, 0.019);
  rounded(0.145, 0.143, 0.009, 0, 0, -0.153, palette.black, base, 0.019);
  for (const side of [-1, 1]) {
    const bevel = box(0.006, 0.008, 0.29, side * 0.074, 0.069, 0, palette.silver, base);
    bevel.rotation.z = side * 0.58;
    box(0.0012, 0.002, 0.235, side * 0.082, -0.025, -0.01, palette.orange, base);
    const brand = label('SIMUCUBE', 0.182, 0.021, side * 0.0825, -0.006, -0.018, base, '#17191d');
    brand.rotation.y = (side * Math.PI) / 2;
    for (let i = 0; i < 7; i++) box(0.001, 0.003, 0.04, side * 0.082, -0.044 - i * 0.004, -0.103, palette.groove, base);
  }
  for (const x of [-0.07, 0.07]) for (const y of [-0.06, 0.06]) bolt(x, y, 0.152, base, 'front');
  const baseLabel = label('SIMUCUBE 3 PRO', 0.13, 0.025, 0, 0.079, -0.015, base);
  baseLabel.rotation.x = -Math.PI / 2;
  baseLabel.position.y = 0.082;
  // Rear I/O connectors and strain relief, visible from the pedal end.
  for (const x of [-0.048, -0.018, 0.012]) {
    rounded(0.018, 0.014, 0.012, x, -0.037, -0.163, palette.groove, base, 0.002);
    rounded(0.011, 0.007, 0.003, x, -0.037, -0.171, palette.silver, base, 0.001);
  }
  rod([0.047, -0.035, -0.152], [0.047, -0.035, -0.177], 0.01, palette.black, base);
  const rearBadge = label('SIMUCUBE', 0.088, 0.017, 0, 0.025, -0.16, base);
  rearBadge.rotation.y = Math.PI;
  componentId = 'quick-release';
  rod([0, 0, 0.14], [0, 0, 0.205], 0.032, palette.silver, base);
  rod([0, 0, 0.18], [0, 0, 0.23], 0.045, palette.black, base);
  for (const z of [0.184, 0.201, 0.222]) rod([0, 0, z - 0.002], [0, 0, z + 0.002], 0.046, palette.edge, base, 48);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    bolt(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0.233, base, 'front');
  }
  assign('wheelbase', 0.08, 0.94, -0.28);
  assign('quick-release', 0, 0.87, -0.055);

  const wheelMount = new THREE.Group();
  wheelMount.name = 'Mounted wheel slot';
  wheelMount.userData.componentId = 'installed-wheel';
  wheelMount.position.set(0, 0.835, -0.005);
  wheelMount.rotation.x = -0.12;
  group.add(wheelMount);
  const wheelModels = new Map();
  function wheelModel(variant) {
    if (!wheelModels.has(variant)) wheelModels.set(variant, createWheel(THREE, variant));
    return wheelModels.get(variant);
  }
  function setWheel(variant) {
    const layout = wheelArrangement(variant);
    wheelMount.clear();
    wheelMount.add(wheelModel(layout.mounted));
    group.updateMatrixWorld(true);
    anchors['installed-wheel'] = wheelMount.localToWorld(new THREE.Vector3(-0.115, 0.055, 0.05));
    group.userData.mountedWheel = layout.mounted;
  }
  setWheel(initialWheel);
  componentId = 'frame';
  // The photo's MagLink cable loops around the base and coils behind the rim.
  const coiledCable = [];
  for (let i = 0; i <= 420; i++) {
    const t = i / 420,
      a = t * Math.PI * 42;
    coiledCable.push([-0.063 + 0.015 * Math.cos(a), 0.859 + 0.015 * Math.sin(a), -0.31 + t * 0.235]);
  }
  mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(coiledCable.map((p) => new THREE.Vector3(...p))),
      520,
      0.0023,
      7,
      false
    ),
    palette.rubber
  ).name = 'Coiled steering wheel USB cable';
  tube([coiledCable[0], [-0.075, 0.83, -0.36], [-0.04, 0.8, -0.43], [-0.018, 0.798, -0.443]], 0.0026, palette.rubber);
  tube([coiledCable[coiledCable.length - 1], [-0.06, 0.846, -0.042], [-0.04, 0.835, -0.035]], 0.0026, palette.rubber);

  // Move the entire keyboard assembly toward the wheelbase along the left rail.
  componentId = 'keyboard-mount';
  const keyboardOffsetZ = -0.34;
  const keyboardSupport = support('DIMSIM keyboard support');
  keyboardSupport.position.z = keyboardOffsetZ;
  box(0.012, 0.11, 0.11, -0.315, 0.2, 0.22, palette.black, keyboardSupport);
  for (const z of [0.19, 0.25]) bolt(-0.324, 0.2, z, keyboardSupport, 'side');
  beam([-0.32, 0.23, 0.22], [-0.4, 0.23, 0.22], 0.04, 0.04, keyboardSupport);
  beam([-0.4, 0.23, 0.22], [-0.4, 0.545, 0.22], 0.04, 0.04, keyboardSupport);
  pivot(-0.4, 0.545, 0.22, keyboardSupport);
  beam([-0.4, 0.545, 0.22], [-0.55, 0.545, 0.13], 0.045, 0.018, keyboardSupport);
  pivot(-0.55, 0.545, 0.13, keyboardSupport);
  beam([-0.55, 0.56, 0.13], [-0.58, 0.575, 0.28], 0.045, 0.018, keyboardSupport);
  pivot(-0.58, 0.575, 0.28, keyboardSupport);
  const keyboard = new THREE.Group();
  keyboard.name = 'Logitech K400 keyboard and tray';
  keyboard.position.set(-0.58, 0.61, 0.28 + keyboardOffsetZ);
  // Face the spacebar edge (+Z) toward the seat pan, rotating around the tray pivot.
  keyboard.rotation.y = Math.atan2(-keyboard.position.x, 0.35 - keyboard.position.z);
  group.add(keyboard);
  box(0.365, 0.006, 0.15, 0, -0.02, 0, palette.black, keyboard);
  box(0.365, 0.015, 0.005, 0, -0.014, 0.075, palette.black, keyboard);
  componentId = 'keyboard';
  const keyboardCase = rounded(0.36, 0.145, 0.02, 0, 0, 0, palette.edge, keyboard, 0.009);
  keyboardCase.rotation.x = -Math.PI / 2;
  const keyboardFace = rounded(0.352, 0.137, 0.002, 0, 0.011, 0, palette.aluminum, keyboard, 0.007);
  keyboardFace.rotation.x = -Math.PI / 2;
  const legends = document.createElement('canvas');
  legends.width = 1024;
  legends.height = 512;
  const kc = legends.getContext('2d');
  kc.fillStyle = '#c0c4c7';
  kc.textAlign = 'center';
  kc.textBaseline = 'middle';
  const keyRows = [
    ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
    ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '−', ['←', 1.5]],
    [['tab', 1.3], 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
    [['caps', 1.4], 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', ['enter', 1.5]],
    [['shift', 1.7], 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', '↑'],
    ['ctrl', 'fn', 'alt', ['', 4.7], 'alt', 'ctrl', '←', '↓', '→']
  ];
  keyRows.forEach((keys, row) => {
    const units = keys.map((key) => (Array.isArray(key) ? key[1] : 1));
    const gap = 0.0022,
      unit = (0.244 - gap * (keys.length - 1)) / units.reduce((sum, value) => sum + value, 0);
    const z = -0.057 + row * 0.0215;
    let left = -0.173;
    keys.forEach((key, i) => {
      const width = unit * units[i],
        x = left + width / 2;
      const keycap = rounded(width, row === 0 ? 0.011 : 0.017, 0.003, x, 0.015, z, palette.black, keyboard, 0.0015);
      keycap.rotation.x = -Math.PI / 2;
      const text = Array.isArray(key) ? key[0] : key;
      kc.font = `${text.length > 2 ? 17 : 23}px Arial`;
      kc.fillText(text, ((x + 0.176) / 0.25) * 1024, ((z + 0.065) / 0.13) * 512, (width / 0.25) * 850);
      left += width + gap;
    });
  });
  const keyMap = new THREE.CanvasTexture(legends);
  keyMap.colorSpace = THREE.SRGBColorSpace;
  keyMap.anisotropy = 4;
  const keyPrint = mesh(
    new THREE.PlaneGeometry(0.25, 0.13),
    new THREE.MeshStandardMaterial({
      map: keyMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.8
    }),
    [-0.051, 0.0173, 0],
    keyboard
  );
  keyPrint.rotation.x = -Math.PI / 2;
  const trackpad = rounded(0.071, 0.082, 0.001, 0.128, 0.013, -0.002, palette.groove, keyboard, 0.003);
  trackpad.rotation.x = -Math.PI / 2;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xbcb24b, roughness: 0.72 });
  box(0.065, 0.001, 0.0012, 0.128, 0.014, 0.038, yellow, keyboard);
  for (const x of [0.11, 0.146]) {
    const click = rounded(0.033, 0.016, 0.002, x, 0.013, 0.049, palette.black, keyboard, 0.002);
    click.rotation.x = -Math.PI / 2;
  }
  const logi = label('logi', 0.027, 0.009, 0.128, 0.013, -0.057, keyboard, '#17191d', '#adb2b6');
  logi.rotation.x = -Math.PI / 2;
  assign('keyboard', -0.58, 0.65, 0.28 + keyboardOffsetZ);
  assign('keyboard-mount', -0.43, 0.55, 0.2 + keyboardOffsetZ);

  // The tray keeps its established position; devices can slide independently.
  componentId = 'frame';
  const controlsOffsetZ = 0.12;
  const rightControls = support('MOZA shifter and handbrake tray');
  rightControls.position.z = controlsOffsetZ;
  // Keep the rail's rear support fixed and trim its front to the relocated tray.
  profile(0.685 - controlsOffsetZ, 0.08, 'z', 0.43, 0.43, -0.0125 + controlsOffsetZ / 2).name =
    'Trimmed right hardware rail';
  beam([0.29, 0.43, -0.22], [0.43, 0.43, -0.22], 0.04, 0.08);
  beam([0.29, 0.2, 0.24], [0.43, 0.2, 0.24], 0.04, 0.08);
  profile(0.37, 0.04, 'y', 0.43, 0.29, 0.24);
  box(0.28, 0.012, 0.43, 0.465, 0.48, -0.14, palette.black, rightControls);
  const devicesOffsetZ = 0.08;
  const mozaControls = new THREE.Group();
  mozaControls.name = 'MOZA devices on tray';
  mozaControls.position.z = devicesOffsetZ;
  rightControls.add(mozaControls);
  componentId = 'shifter-base';
  // AB9: chamfered vertical housing and recessed top aperture from MOZA's drawing.
  // The mounting tray and lever endpoint retain the owner's established placement.
  const ab9Outline = new THREE.Shape();
  [
    [-0.0585, -0.114],
    [0.0585, -0.114],
    [0.0785, -0.094],
    [0.0785, 0.094],
    [0.0585, 0.114],
    [-0.0585, 0.114],
    [-0.0785, 0.094],
    [-0.0785, -0.094]
  ].forEach(([x, z], i) => (i ? ab9Outline.lineTo(x, z) : ab9Outline.moveTo(x, z)));
  ab9Outline.closePath();
  function ab9Panel(shape, height, y, material, name) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: true,
      bevelSize: 0.0015,
      bevelThickness: 0.001,
      bevelSegments: 3,
      curveSegments: 12
    });
    geometry.translate(0, 0, -height / 2);
    const panel = mesh(geometry, material, [0.43, y, -0.19], mozaControls);
    panel.rotation.x = Math.PI / 2;
    panel.name = name;
    return panel;
  }
  ab9Panel(ab9Outline, 0.175, 0.58, palette.black, 'MOZA AB9 chamfered housing');
  ab9Panel(ab9Outline, 0.02, 0.504, palette.aluminum, 'MOZA lower housing seam');
  const topOutline = ab9Outline.clone();
  const aperture = new THREE.Path();
  aperture.moveTo(-0.032, -0.053);
  aperture.lineTo(0.032, -0.053);
  aperture.quadraticCurveTo(0.044, -0.053, 0.044, -0.041);
  aperture.lineTo(0.044, 0.041);
  aperture.quadraticCurveTo(0.044, 0.053, 0.032, 0.053);
  aperture.lineTo(-0.032, 0.053);
  aperture.quadraticCurveTo(-0.044, 0.053, -0.044, 0.041);
  aperture.lineTo(-0.044, -0.041);
  aperture.quadraticCurveTo(-0.044, -0.053, -0.032, -0.053);
  topOutline.holes.push(aperture);
  ab9Panel(topOutline, 0.007, 0.674, palette.edge, 'Recessed AB9 gaiter frame');
  for (const side of [-1, 1]) {
    for (const z of [-0.27, -0.11])
      box(0.0015, 0.137, 0.003, 0.43 + side * 0.079, 0.584, z, palette.groove, mozaControls);
    const wordmark = label('MOZA', 0.074, 0.016, 0.43 + side * 0.08, 0.548, -0.19, mozaControls, '#141619', '#a8aaab');
    wordmark.rotation.y = (side * Math.PI) / 2;
  }
  for (const x of [0.373, 0.487]) for (const z of [-0.283, -0.097]) bolt(x, 0.679, z, mozaControls);
  const mozaLabel = label('MOZA', 0.052, 0.013, 0.43, 0.679, -0.103, mozaControls, '#373b40', '#bda66e');
  mozaLabel.rotation.x = -Math.PI / 2;
  // Rear ports occupy the lower end panel; cables return to the adjacent rail.
  for (let i = 0; i < 4; i++) {
    const x = 0.397 + i * 0.017;
    rounded(0.013, 0.012, 0.004, x, 0.524, -0.306, palette.groove, mozaControls, 0.001);
    box(0.009, 0.002, 0.001, x, 0.522, -0.309, palette.edge, mozaControls);
  }
  rounded(0.012, 0.013, 0.005, 0.373, 0.524, -0.306, palette.silver, mozaControls, 0.001);
  rod([0.488, 0.524, -0.304], [0.488, 0.524, -0.316], 0.006, palette.black, mozaControls);
  // Flexible gaiter around the lever, with folded cloth instead of a bare shaft.
  const gaiterPositions = [],
    gaiterIndices = [];
  function gaiterPoint(t, a, lift = 0) {
    const fold = 1 + 0.065 * Math.sin(a * 8 + t * 5),
      power = 0.52 + 0.48 * t;
    const rx = (0.042 * (1 - t) + 0.011 * t) * fold,
      rz = (0.051 * (1 - t) + 0.011 * t) * fold;
    const cx = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** power;
    const sz = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** power;
    return [0.43 + rx * cx, 0.674 + t * 0.039 + lift, -0.19 + t * 0.02 + rz * sz];
  }
  for (let row = 0; row <= 14; row++)
    for (let col = 0; col <= 48; col++) {
      gaiterPositions.push(...gaiterPoint(row / 14, (col / 48) * Math.PI * 2));
      if (row < 14 && col < 48) {
        const k = row * 49 + col;
        gaiterIndices.push(k, k + 49, k + 1, k + 1, k + 49, k + 50);
      }
    }
  const gaiterGeometry = new THREE.BufferGeometry();
  gaiterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gaiterPositions, 3));
  gaiterGeometry.setIndex(gaiterIndices);
  gaiterGeometry.computeVertexNormals();
  const leather = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.53 });
  mesh(gaiterGeometry, leather, null, mozaControls).name = 'MOZA leather lever gaiter';
  const stitches = [];
  for (let corner = 0; corner < 4; corner++)
    for (const offset of [-0.025, 0.025]) {
      const a = Math.PI / 4 + (corner * Math.PI) / 2 + offset;
      for (let i = 0; i < 18; i++) {
        stitches.push(...gaiterPoint(i / 18, a, 0.0005), ...gaiterPoint((i + 0.55) / 18, a, 0.0005));
      }
    }
  const seamGeo = new THREE.BufferGeometry();
  seamGeo.setAttribute('position', new THREE.Float32BufferAttribute(stitches, 3));
  const seams = new THREE.LineSegments(seamGeo, new THREE.LineBasicMaterial({ color: 0xa99c7c }));
  seams.userData.componentId = componentId;
  seams.name = 'Double-stitched leather gaiter seams';
  mozaControls.add(seams);
  componentId = 'shifter-handle';
  rod([0.43, 0.69, -0.182], [0.43, 0.83, -0.1], 0.009, palette.black, mozaControls);
  rod([0.43, 0.76, -0.13], [0.43, 0.87, -0.09], 0.0175, palette.rubber, mozaControls);
  for (let i = 0; i < 4; i++)
    rod(
      [0.43, 0.775 + i * 0.021, -0.124 + i * 0.008],
      [0.43, 0.78 + i * 0.021, -0.122 + i * 0.008],
      0.018,
      palette.silver,
      mozaControls
    );
  assign('shifter-base', 0.45, 0.68, -0.16 + controlsOffsetZ + devicesOffsetZ);
  assign('shifter-handle', 0.43, 0.87, -0.09 + controlsOffsetZ + devicesOffsetZ);
  componentId = 'handbrake';
  const brake = new THREE.Group();
  brake.name = 'MOZA HBP beside the AB9';
  brake.position.set(0.55, 0.52, -0.19);
  mozaControls.add(brake);
  // HBP wedge and open pivot plates replace the generic rectangular housing.
  box(0.068, 0.006, 0.153, 0, -0.028, 0, palette.black, brake);
  const cheekShape = new THREE.Shape();
  [
    [-0.076, -0.025],
    [0.076, -0.025],
    [0.064, 0.018],
    [-0.046, 0.046],
    [-0.076, 0.016]
  ].forEach(([z, y], i) => (i ? cheekShape.lineTo(z, y) : cheekShape.moveTo(z, y)));
  cheekShape.closePath();
  for (const z of [-0.052, 0.048]) {
    const hole = new THREE.Path();
    hole.absarc(z, -0.007, 0.004, 0, Math.PI * 2, true);
    cheekShape.holes.push(hole);
  }
  function brakePlate(shape, x, depth, material, name) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.0007,
      bevelThickness: 0.0005,
      bevelSegments: 2,
      curveSegments: 10
    });
    geo.translate(0, 0, -depth / 2);
    const plate = mesh(geo, material, [x, 0, 0], brake);
    plate.rotation.y = -Math.PI / 2;
    plate.name = name;
    return plate;
  }
  for (const side of [-1, 1]) {
    brakePlate(cheekShape, side * 0.031, 0.006, palette.aluminum, 'HBP machined side plate');
    for (const z of [-0.052, 0.048]) bolt(side * 0.036, -0.007, z, brake, 'side');
    const wordmark = label('MOZA', 0.055, 0.011, side * 0.035, 0.018, -0.024, brake, '#17191d', '#c1c4c6');
    wordmark.rotation.y = (side * Math.PI) / 2;
  }
  const cover = box(0.056, 0.004, 0.102, 0, 0.032, -0.012, palette.black, brake);
  cover.rotation.x = 0.25;
  rod([-0.038, 0.032, 0.023], [0.038, 0.032, 0.023], 0.01, palette.black, brake);
  for (const side of [-1, 1]) bolt(side * 0.041, 0.032, 0.023, brake, 'side');
  const arm = new THREE.Shape();
  [
    [0.012, 0.025],
    [0.035, 0.022],
    [0.086, 0.145],
    [0.072, 0.19],
    [0.089, 0.214],
    [0.105, 0.204],
    [0.093, 0.174],
    [0.107, 0.143],
    [0.05, 0.048]
  ].forEach(([z, y], i) => (i ? arm.lineTo(z, y) : arm.moveTo(z, y)));
  arm.closePath();
  for (const [z, y] of [
    [0.027, 0.039],
    [0.088, 0.146],
    [0.084, 0.181]
  ]) {
    const hole = new THREE.Path();
    hole.absarc(z, y, 0.004, 0, Math.PI * 2, true);
    arm.holes.push(hole);
  }
  brakePlate(arm, 0, 0.012, palette.aluminum, 'HBP adjustable cranked lever');
  for (const side of [-1, 1])
    for (const [z, y] of [
      [0.027, 0.039],
      [0.088, 0.146],
      [0.084, 0.181]
    ])
      bolt(side * 0.01, y, z, brake, 'side');
  rod([0, 0.19, 0.087], [0, 0.36, 0.13], 0.016, palette.rubber, brake);
  const gripAxis = new THREE.Vector3(0, 0.17, 0.043).normalize();
  for (const t of [0.72, 0.81, 0.9, 1]) {
    const centre = new THREE.Vector3(0, 0.19, 0.087).lerp(new THREE.Vector3(0, 0.36, 0.13), t);
    rod(
      centre.clone().addScaledVector(gripAxis, -0.0007).toArray(),
      centre.clone().addScaledVector(gripAxis, 0.0007).toArray(),
      0.0165,
      palette.silver,
      brake,
      32
    );
  }
  rounded(0.013, 0.012, 0.004, -0.013, -0.007, -0.08, palette.groove, brake, 0.001);
  for (const z of [-0.25, -0.13]) bolt(0.59, 0.49, z, mozaControls);
  assign('handbrake', 0.55, 0.9, -0.06 + controlsOffsetZ + devicesOffsetZ);
  componentId = 'frame';
  tube(
    [
      [0.373, 0.524, -0.112],
      [0.373, 0.51, -0.14],
      [0.352, 0.495, -0.17],
      [0.342, 0.483, -0.13],
      [0.341, 0.474, 0.045],
      [0.309, 0.45, 0.08]
    ],
    0.0028,
    palette.groove
  ).name = 'AB9 USB lead to frame';
  tube(
    [
      [0.488, 0.524, -0.116],
      [0.505, 0.505, -0.15],
      [0.593, 0.496, -0.17],
      [0.604, 0.477, -0.1],
      [0.602, 0.474, 0.08],
      [0.44, 0.45, 0.13]
    ],
    0.0035,
    palette.rubber
  ).name = 'AB9 power lead along tray';
  tube(
    [
      [0.537, 0.513, -0.07],
      [0.54, 0.505, -0.096],
      [0.59, 0.496, -0.12],
      [0.603, 0.481, -0.08],
      [0.605, 0.477, 0.06]
    ],
    0.0022,
    palette.groove
  ).name = 'HBP USB lead';
  // DIMSIM clamps directly to the wheel upright, with a folded plate and
  // short adjustable cheeks behind the box instead of a floor-height pillar.
  componentId = 'button-mount';
  const buttonOffsetZ = controlsOffsetZ;
  const buttonSupport = support('DIMSIM button box support');
  const buttonBox = new THREE.Group();
  buttonBox.name = 'DIMSIM button box';
  buttonBox.position.set(0.39, 0.85, -0.34 + buttonOffsetZ);
  buttonBox.rotation.x = -0.25;
  buttonBox.rotation.y = -0.18;
  group.add(buttonBox);
  cameraMount(buttonBox, [0, -0.012, -0.047], 1, buttonSupport);
  rounded(0.108, 0.132, 0.006, 0, 0, -0.031, palette.black, buttonBox, 0.01);
  componentId = 'buttonbox';
  rounded(0.18, 0.2, 0.05, 0, 0, 0, palette.black, buttonBox);
  // Powder-coated face, red switch guards and illuminated controls from the owner's box.
  rounded(0.173, 0.192, 0.002, 0, 0, 0.0265, palette.aluminum, buttonBox, 0.005);
  const controlColors = [0xef3340, 0x63bdc6, 0xe5d5b0];
  const rings = controlColors.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        metalness: 0.15,
        roughness: 0.4
      })
  );
  function control(x, y, text, colorIndex, encoder = false) {
    rod([x, y, 0.028], [x, y, 0.033], 0.013, palette.black, buttonBox, 24);
    mesh(new THREE.TorusGeometry(0.0106, 0.0013, 8, 32), rings[colorIndex], [x, y, 0.034], buttonBox);
    rod([x, y, 0.033], [x, y, encoder ? 0.047 : 0.038], 0.0085, palette.black, buttonBox, 24);
    if (encoder) {
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8;
        rod(
          [x + Math.cos(a) * 0.0085, y + Math.sin(a) * 0.0085, 0.035],
          [x + Math.cos(a) * 0.0085, y + Math.sin(a) * 0.0085, 0.046],
          0.0008,
          palette.edge,
          buttonBox,
          6
        );
      }
      box(0.0012, 0.006, 0.001, x, y + 0.003, 0.048, palette.silver, buttonBox);
    }
    label(text, 0.031, 0.005, x, y - 0.018, 0.028, buttonBox, '#141619', '#c9ccce');
  }
  for (const x of [-0.047, 0.01]) {
    rounded(0.026, 0.038, 0.003, x, 0.057, 0.03, palette.silver, buttonBox, 0.003);
    rod([x, 0.05, 0.031], [x, 0.062, 0.048], 0.003, palette.silver, buttonBox);
    for (const side of [-1, 1]) box(0.003, 0.03, 0.015, x + side * 0.014, 0.059, 0.038, palette.red, buttonBox);
    box(0.031, 0.006, 0.015, x, 0.074, 0.038, palette.red, buttonBox);
  }
  control(0.061, 0.056, 'ENGINE', 0);
  [
    ['BIAS', 0, true],
    ['TC', 0, true],
    ['ABS', 2, true]
  ].forEach(([name, c, e], i) => control(-0.055 + i * 0.055, 0.005, name, c, e));
  [
    ['RADIO', 1, false],
    ['PIT', 0, false],
    ['LIGHTS', 0, false]
  ].forEach(([name, c, e], i) => control(-0.055 + i * 0.055, -0.054, name, c, e));
  for (const x of [-0.077, 0.077])
    for (const y of [-0.084, 0.084]) {
      rod([x, y, 0.028], [x, y, 0.03], 0.003, palette.silver, buttonBox, 12);
      rod([x, y, 0.03], [x, y, 0.031], 0.0014, palette.groove, buttonBox, 6);
    }
  label('DIMSIM', 0.105, 0.014, 0, 0.087, 0.028, buttonBox, '#a9aaa5', '#17191a');
  const dimsimPlaque = label('DIMSIM', 0.115, 0.026, 0, 0.102, 0, buttonBox, '#abaea7', '#17191a');
  dimsimPlaque.rotation.x = -Math.PI / 2;
  assign('buttonbox', 0.37, 0.94, -0.28 + buttonOffsetZ);
  assign('button-mount', 0.435, 0.81, -0.39 + buttonOffsetZ);

  // Ulanzi uses a shallow top shelf and a compact camera-style tilt bracket.
  componentId = 'streamdeck';
  const deckSupport = support('Ulanzi articulated support');
  const deck = new THREE.Group();
  deck.name = 'Ulanzi D200H and backplate';
  deck.position.set(-0.38, 0.85, -0.2);
  deck.rotation.x = -0.55;
  deck.rotation.y = 0.22;
  group.add(deck);
  cameraMount(deck, [0, -0.012, -0.037], -1, deckSupport);
  rounded(0.126, 0.076, 0.006, 0, -0.01, -0.021, palette.black, deck, 0.008);
  rounded(0.168, 0.096, 0.031, 0, 0, 0, palette.edge, deck, 0.006);
  rounded(0.16, 0.088, 0.002, 0, 0, 0.017, palette.black, deck, 0.004);
  const keyLabels = [
    'PIT',
    'RADIO',
    'LIGHTS',
    'WIPER',
    'IGN',
    'ABS +',
    'TC +',
    'BIAS +',
    'MAP +',
    'START',
    'ABS −',
    'TC −',
    'BIAS −',
    'MAP −'
  ];
  const keyColors = ['#69a7db', '#e0bc65', '#d1d6d9', '#6f9ddd', '#e56765'];
  for (let i = 0; i < 15; i++) {
    const col = i % 5,
      row = Math.floor(i / 5),
      x = -0.06 + col * 0.03,
      y = 0.027 - row * 0.027;
    if (i === 14) {
      label('ULANZI', 0.025, 0.007, x, y, 0.019, deck, '#15171a', '#92989d');
      continue;
    }
    rounded(0.025, 0.022, 0.002, x, y, 0.019, palette.groove, deck, 0.003);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111923';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = keyColors[col];
    ctx.strokeStyle = keyColors[col];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 46, 23, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row === 0 ? ['P', 'R', 'L', 'W', 'I'][col] : row === 1 ? '+' : '−', 64, 46);
    ctx.fillStyle = '#e3eaf0';
    ctx.font = 'bold 17px Arial';
    ctx.fillText(keyLabels[i], 64, 100, 118);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.MeshBasicMaterial({ map, toneMapped: false });
    mesh(new THREE.PlaneGeometry(0.0215, 0.019), screen, [x, y, 0.0205], deck);
  }
  // Raised dock edge with USB-A / USB-C ports and the photographed right-angle cable.
  rounded(0.153, 0.027, 0.025, 0, 0.053, -0.006, palette.edge, deck, 0.003);
  for (const [x, w] of [
    [-0.045, 0.018],
    [-0.016, 0.012],
    [0.012, 0.012]
  ]) {
    box(w, 0.001, 0.007, x, 0.067, -0.006, palette.groove, deck);
    box(w * 0.75, 0.001, 0.002, x, 0.0676, -0.006, x === -0.045 ? palette.blue : palette.silver, deck);
  }
  const dockMark = label('Ulanzi', 0.027, 0.01, 0.049, 0.0672, -0.006, deck, '#373b40', '#a4a9af');
  dockMark.rotation.x = -Math.PI / 2;
  rounded(0.034, 0.009, 0.012, 0.014, 0.074, -0.006, palette.black, deck, 0.003);
  tube(
    [
      [0.03, 0.074, -0.006],
      [0.07, 0.078, -0.008],
      [0.092, 0.057, -0.04],
      [0.065, 0.006, -0.068],
      [0, -0.045, -0.065]
    ],
    0.0026,
    palette.groove,
    deck
  ).name = 'Ulanzi dock cable loop';
  assign('streamdeck', -0.38, 0.91, -0.18);

  // DIMSIM accessory bracket bolts onto the left seat hinge, as in the photos.
  componentId = 'hooks';
  const seatHooks = support('DIMSIM seat-mounted hooks');
  box(0.01, 0.1, 0.13, -0.267, 0.435, 0.51, palette.black, seatHooks);
  for (const z of [0.47, 0.55]) bolt(-0.274, 0.415, z, seatHooks, 'side');
  beam([-0.273, 0.405, 0.51], [-0.29, 0.59, 0.59], 0.028, 0.012, seatHooks);
  box(0.075, 0.008, 0.14, -0.315, 0.59, 0.59, palette.black, seatHooks);
  for (const z of [0.55, 0.635]) {
    tube(
      [
        [-0.33, 0.59, z],
        [-0.395, 0.59, z],
        [-0.405, 0.62, z]
      ],
      0.009,
      palette.black,
      seatHooks
    );
    bolt(-0.32, 0.597, z, seatHooks);
  }
  assign('hooks', -0.38, 0.63, 0.59);

  componentId = 'vr-headset';
  const headsetAssembly = support('Pimax headset and tether');
  headsetAssembly.userData.componentId = componentId;
  const headset = createHeadset(THREE);
  headset.userData.componentId = componentId;
  // Hang nose-down by the rear headband, with its width along the seat side.
  // The cradle underside rests at hook height; upturned tips stay outside it.
  headset.rotation.set(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');
  headset.position.set(-0.345, 0.477, 0.59);
  headsetAssembly.add(headset);
  headset.updateWorldMatrix(true, false);
  anchors['vr-headset'] = headset.localToWorld(headset.userData.hotspot.clone());
  const cablePoint = headset.localToWorld(headset.userData.cablePoint.clone());
  tube(
    [cablePoint.toArray(), [-0.4, 0.415, 0.75], [-0.465, 0.28, 0.735], [-0.44, 0.225, 0.64], [-0.31, 0.24, 0.56]],
    0.003,
    palette.groove,
    headsetAssembly
  ).name = 'Pimax tether to cockpit cable routing';

  componentId = 'shakers';
  // Hidden essentials still have physical meshes and inspectable anchor points.
  for (const z of [0.3, 0.61]) {
    mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.045, 32), palette.black, [0, 0.25, z]);
    mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.048, 32), palette.edge, [0, 0.25, z]);
  }
  assign('shakers', 0.02, 0.28, 0.56);
  // Front electronics shelf: amplifier directly below the Link Hub.
  componentId = 'frame';
  const electronics = support('Front electronics shelf');
  box(0.16, 0.008, 0.15, -0.29, 0.219, -0.39, palette.black, electronics);
  box(0.012, 0.08, 0.15, -0.315, 0.18, -0.39, palette.black, electronics);
  for (const x of [-0.33, -0.25])
    for (const z of [-0.42, -0.36]) box(0.016, 0.006, 0.016, x, 0.225, z, palette.rubber, electronics);
  componentId = 'amp';
  const amp = rounded(0.125, 0.04, 0.1, -0.29, 0.25, -0.39, palette.aluminum);
  amp.name = 'Fosi Audio BT20A amplifier';
  for (const x of [-0.33, -0.29, -0.25]) rod([x, 0.25, -0.338], [x, 0.25, -0.329], 0.009, palette.black);
  label('FOSI AUDIO', 0.065, 0.012, -0.29, 0.266, -0.336);
  assign('amp', -0.35, 0.26, -0.33);
  // ACASIS sits low along the same rail, farther toward the pedals than Fosi.
  componentId = 'usb';
  const usb = support('ACASIS hub on front rail');
  box(0.056, 0.006, 0.14, -0.29, 0.218, -0.565, palette.black, usb);
  rounded(0.052, 0.023, 0.14, -0.29, 0.235, -0.565, palette.aluminum, usb);
  for (let i = 0; i < 4; i++) box(0.02, 0.002, 0.009, -0.29, 0.249, -0.61 + i * 0.03, palette.blue, usb);
  for (const z of [-0.629, -0.501]) box(0.061, 0.032, 0.009, -0.29, 0.234, z, palette.rubber, usb);
  assign('usb', -0.335, 0.27, -0.565);
  componentId = 'link-hub';
  box(0.09, 0.006, 0.112, -0.28, 0.29, -0.39, palette.black, electronics);
  box(0.09, 0.07, 0.006, -0.28, 0.258, -0.445, palette.black, electronics);
  const linkHub = rounded(0.07, 0.038, 0.08, -0.28, 0.312, -0.39, palette.black);
  linkHub.name = 'Simucube Link Hub';
  label('SIMUCUBE', 0.062, 0.01, -0.28, 0.312, -0.346);
  assign('link-hub', -0.28, 0.36, -0.39);
  componentId = 'power-strip';
  rounded(0.05, 0.035, 0.4, 0.31, 0.2, 0.36, palette.black);
  for (let i = 0; i < 8; i++) {
    mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.002, 16), palette.groove, [0.31, 0.219, 0.2 + i * 0.045]);
  }
  assign('power-strip', 0.34, 0.25, 0.38);
  componentId = 'velcro';
  for (const z of [-0.35, 0.02, 0.4]) box(0.049, 0.125, 0.021, -0.29, 0.157, z, palette.rubber);
  assign('velcro', -0.3, 0.22, 0.02);
  componentId = 'frame';
  tube(
    [
      [-0.07, 0.8, -0.41],
      [-0.18, 0.72, -0.44],
      [-0.25, 0.38, -0.28],
      [-0.29, 0.24, -0.32],
      [-0.33, 0.24, -0.44]
    ],
    0.004,
    palette.groove
  );
  tube(
    [
      [0.08, 0.8, -0.4],
      [0.25, 0.72, -0.31],
      [0.26, 0.26, -0.3],
      [0.28, 0.23, 0.35]
    ],
    0.004,
    palette.groove
  );
  tube(
    [
      [-0.29, 0.24, -0.63],
      [-0.32, 0.22, -0.66],
      [-0.32, 0.22, -0.4],
      [-0.28, 0.32, -0.38]
    ],
    0.003,
    palette.groove
  );
  const isComponentVisible = (id) => id !== 'vr-headset' || headsetAssembly.visible;
  return {
    group,
    anchors,
    setWheel,
    isComponentVisible,
    setHeadsetVisible(value) {
      headsetAssembly.visible = value;
    },
    getComponentMeshes: (id) => (isComponentVisible(id) ? componentMeshes(group, id) : [])
  };
}
