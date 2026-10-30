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
    aluminum: new THREE.MeshStandardMaterial({ color: 0x343a42, metalness: 0.42, roughness: 0.43 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x515963, metalness: 0.45, roughness: 0.4 }),
    groove: new THREE.MeshStandardMaterial({ color: 0x0b0e12, metalness: 0.25, roughness: 0.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x242a31, metalness: 0.28, roughness: 0.46 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.94 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xbac0c5, metalness: 0.6, roughness: 0.38 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xef751b, metalness: 0.42, roughness: 0.4 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc71832, roughness: 0.8 }),
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
      bevelSize: 0.003,
      bevelThickness: 0.003,
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
  function tube(points, radius, material, parent = group) {
    const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(path, 32, radius, 8, false), material, null, parent);
  }
  function bolt(x, y, z, parent = group, face = 'top') {
    const m = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 6), palette.silver, [x, y, z], parent);
    if (face === 'front') m.rotation.x = Math.PI / 2;
    if (face === 'side') m.rotation.z = Math.PI / 2;
    return m;
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
    for (const z of [-0.71, 0.6]) {
      rod([x, 0.025, z], [x, 0.096, z], 0.021, palette.black);
      mesh(new THREE.CylinderGeometry(0.04, 0.043, 0.025, 32), palette.rubber, [x, 0.018, z]);
      box(0.08, 0.008, 0.085, x, 0.223, z, palette.black);
      bolt(x, 0.23, z);
    }
    profile(0.63, 0.08, 'y', x, 0.51, -0.22);
    box(0.009, 0.15, 0.17, x + Math.sign(x) * 0.025, 0.265, -0.22, palette.black);
    for (const y of [0.23, 0.29]) for (const z of [-0.27, -0.17]) bolt(x + Math.sign(x) * 0.031, y, z, group, 'side');
  }
  for (const z of [-0.77, -0.46, 0.35, 0.68]) profile(0.56, 0.08, 'x', 0, 0.155, z);
  profile(0.6, 0.08, 'x', 0, 0.8, -0.22);
  label('MAXSIM', 0.25, 0.036, 0, 0.16, 0.707);
  assign('frame', -0.31, 0.22, 0.6);

  const pedals = createPedals(THREE);
  group.add(pedals.group);
  Object.assign(anchors, pedals.anchors);

  // Seat sliders and sculpted bucket shell.
  for (const x of [-0.18, 0.18]) {
    profile(0.48, 0.04, 'z', x, 0.24, 0.43);
    box(0.035, 0.04, 0.4, x, 0.28, 0.44, palette.black);
    for (const z of [0.3, 0.58]) bolt(x, 0.305, z);
  }
  const seat = createSeat(THREE);
  group.add(seat);
  assign('seat', -0.23, 1.05, 0.65);
  assign('harness', -0.11, 0.84, 0.48);

  componentId = 'wheelbase';
  // Direct-drive base and QR, with the steering wheel facing the driver (+Z).
  const base = new THREE.Group();
  base.position.set(0, 0.835, -0.27);
  group.add(base);
  rounded(0.145, 0.145, 0.303, 0, 0, 0, palette.aluminum, base, 0.024);
  rounded(0.135, 0.135, 0.01, 0, 0, 0.145, palette.black, base, 0.02);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) box(0.001, 0.007, 0.23, side * 0.075, -0.06 + i * 0.025, -0.005, palette.groove, base);
  for (const x of [-0.07, 0.07]) for (const y of [-0.06, 0.06]) bolt(x, y, 0.152, base, 'front');
  const baseLabel = label('SIMUCUBE 3 PRO', 0.13, 0.025, 0, 0.079, -0.015, base);
  baseLabel.rotation.x = -Math.PI / 2;
  componentId = 'quick-release';
  rod([0, 0, 0.14], [0, 0, 0.205], 0.032, palette.silver, base);
  rod([0, 0, 0.18], [0, 0, 0.23], 0.045, palette.black, base);
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
  rounded(0.36, 0.025, 0.145, 0, 0, 0, palette.rubber, keyboard);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 11; col++)
      box(0.018, 0.004, 0.018, -0.16 + col * 0.022, 0.017, -0.052 + row * 0.026, palette.edge, keyboard);
  box(0.09, 0.004, 0.015, -0.06, 0.017, 0.052, palette.edge, keyboard);
  box(0.07, 0.002, 0.084, 0.13, 0.017, 0.006, palette.groove, keyboard);
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
  rounded(0.13, 0.11, 0.21, 0.43, 0.55, -0.19, palette.black, mozaControls);
  componentId = 'shifter-handle';
  rod([0.43, 0.6, -0.19], [0.43, 0.83, -0.1], 0.012, palette.silver, mozaControls);
  rod([0.43, 0.76, -0.13], [0.43, 0.87, -0.09], 0.023, palette.rubber, mozaControls);
  for (let i = 0; i < 4; i++)
    rod(
      [0.43, 0.775 + i * 0.021, -0.124 + i * 0.008],
      [0.43, 0.78 + i * 0.021, -0.122 + i * 0.008],
      0.024,
      palette.silver,
      mozaControls
    );
  assign('shifter-base', 0.45, 0.58, -0.16 + controlsOffsetZ + devicesOffsetZ);
  assign('shifter-handle', 0.43, 0.87, -0.09 + controlsOffsetZ + devicesOffsetZ);
  componentId = 'handbrake';
  const brake = new THREE.Group();
  brake.name = 'MOZA HBP beside the AB9';
  brake.position.set(0.55, 0.52, -0.19);
  mozaControls.add(brake);
  rounded(0.085, 0.1, 0.17, 0, 0, 0, palette.black, brake);
  rod([0, 0.045, 0.035], [0, 0.33, 0.12], 0.013, palette.aluminum, brake);
  rod([0, 0.22, 0.087], [0, 0.36, 0.13], 0.022, palette.rubber, brake);
  for (const z of [-0.25, -0.13]) bolt(0.59, 0.49, z, mozaControls);
  assign('handbrake', 0.55, 0.9, -0.06 + controlsOffsetZ + devicesOffsetZ);
  // DIMSIM clamps directly to the wheel upright, with a folded plate and
  // short adjustable cheeks behind the box instead of a floor-height pillar.
  componentId = 'button-mount';
  const buttonOffsetZ = controlsOffsetZ;
  const buttonPivotZ = -0.408 + buttonOffsetZ;
  const buttonSupport = support('DIMSIM button box support');
  box(0.01, 0.104, 0.1, 0.316, 0.724, -0.22, palette.black, buttonSupport);
  for (const y of [0.688, 0.76]) for (const z of [-0.248, -0.192]) bolt(0.324, y, z, buttonSupport, 'side');
  slottedPlate([0.322, 0.699, -0.22], [0.395, 0.699, buttonPivotZ], 0.052, 0.006, [0, 1, 0], buttonSupport);
  // Triangular folded gussets tie the cantilever into the upright clamp.
  for (const z of [-0.238, -0.214])
    slottedPlate([0.32, 0.751, z], [0.346, 0.699, z - 0.016], 0.022, 0.005, [0, 0, 1], buttonSupport);
  const buttonBox = new THREE.Group();
  buttonBox.name = 'DIMSIM button box';
  buttonBox.position.set(0.39, 0.85, -0.34 + buttonOffsetZ);
  buttonBox.rotation.x = -0.25;
  buttonBox.rotation.y = -0.18;
  group.add(buttonBox);
  buttonBox.updateWorldMatrix(true, false);
  const buttonJoint = buttonBox.localToWorld(new THREE.Vector3(0, -0.012, -0.058));
  for (const side of [-1, 1])
    slottedPlate(
      [0.395 + side * 0.025, 0.704, buttonPivotZ],
      [buttonJoint.x + side * 0.025, buttonJoint.y, buttonJoint.z],
      0.035,
      0.005,
      [1, 0, 0],
      buttonSupport
    );
  crossHinge([0.395, 0.704, buttonPivotZ], 0.065, buttonSupport);
  crossHinge(buttonJoint.toArray(), 0.067, buttonSupport);
  rounded(0.108, 0.132, 0.006, 0, 0, -0.031, palette.black, buttonBox, 0.01);
  box(0.05, 0.038, 0.022, 0, -0.012, -0.045, palette.edge, buttonBox);
  for (const x of [-0.039, 0.039]) for (const y of [-0.048, 0.048]) bolt(x, y, -0.037, buttonBox, 'front');
  componentId = 'buttonbox';
  rounded(0.18, 0.2, 0.05, 0, 0, 0, palette.black, buttonBox);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const button = mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.012, 20),
        row === 0 ? palette.red : palette.silver,
        [(col - 1) * 0.05, 0.055 - row * 0.052, 0.032],
        buttonBox
      );
      button.rotation.x = Math.PI / 2;
    }
  label('DIMSIM', 0.11, 0.016, 0, -0.087, 0.027, buttonBox);
  assign('buttonbox', 0.37, 0.94, -0.28 + buttonOffsetZ);
  assign('button-mount', 0.435, 0.75, -0.41 + buttonOffsetZ);

  // Ulanzi uses a shallow top shelf and a compact camera-style tilt bracket.
  componentId = 'streamdeck';
  const deckSupport = support('Ulanzi articulated support');
  box(0.01, 0.094, 0.1, -0.316, 0.752, -0.22, palette.black, deckSupport);
  for (const y of [0.72, 0.785]) for (const z of [-0.248, -0.192]) bolt(-0.324, y, z, deckSupport, 'side');
  slottedPlate([-0.35, 0.791, -0.3], [-0.35, 0.791, -0.2], 0.072, 0.006, [0, 1, 0], deckSupport);
  for (const z of [-0.25, -0.2])
    slottedPlate([-0.322, 0.74, z], [-0.365, 0.788, z], 0.022, 0.005, [0, 0, 1], deckSupport);
  const deck = new THREE.Group();
  deck.name = 'Ulanzi D200H and backplate';
  deck.position.set(-0.38, 0.85, -0.2);
  deck.rotation.x = -0.55;
  deck.rotation.y = 0.22;
  group.add(deck);
  rounded(0.126, 0.076, 0.006, 0, -0.01, -0.021, palette.black, deck, 0.008);
  box(0.052, 0.035, 0.017, 0, -0.012, -0.033, palette.edge, deck);
  for (const x of [-0.045, 0.045]) for (const y of [-0.036, 0.016]) bolt(x, y, -0.027, deck, 'front');
  deck.updateWorldMatrix(true, false);
  const deckJoint = deck.localToWorld(new THREE.Vector3(0, -0.012, -0.043));
  const deckPivot = [-0.35, 0.803, -0.296];
  for (const side of [-1, 1])
    slottedPlate(
      [deckPivot[0] + side * 0.024, deckPivot[1], deckPivot[2]],
      [deckJoint.x + side * 0.024, deckJoint.y, deckJoint.z],
      0.03,
      0.005,
      [1, 0, 0],
      deckSupport
    );
  crossHinge(deckPivot, 0.062, deckSupport);
  crossHinge(deckJoint.toArray(), 0.064, deckSupport);
  rounded(0.154, 0.09, 0.026, 0, 0, 0, palette.black, deck);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const color = new THREE.MeshStandardMaterial({
        color: [0x3f6f8b, 0x647f61, 0x9a6344, 0x655b8a][col],
        emissive: 0x14212b,
        emissiveIntensity: 0.1,
        roughness: 0.35
      });
      rounded(0.023, 0.023, 0.002, -0.046 + col * 0.031, 0.032 - row * 0.032, 0.016, color, deck, 0.003);
    }
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
  const headset = createHeadset(THREE);
  headset.userData.componentId = componentId;
  // Hang nose-down by the rear headband, with its width along the seat side.
  // The cradle underside rests at hook height; upturned tips stay outside it.
  headset.rotation.set(-Math.PI / 2, Math.PI / 2, 0, 'YXZ');
  headset.position.set(-0.345, 0.477, 0.59);
  group.add(headset);
  headset.updateWorldMatrix(true, false);
  anchors['vr-headset'] = headset.localToWorld(headset.userData.hotspot.clone());
  const cablePoint = headset.localToWorld(headset.userData.cablePoint.clone());
  tube(
    [cablePoint.toArray(), [-0.4, 0.415, 0.75], [-0.465, 0.28, 0.735], [-0.44, 0.225, 0.64], [-0.31, 0.24, 0.56]],
    0.003,
    palette.groove
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
  return { group, anchors, setWheel, getComponentMeshes: (id) => componentMeshes(group, id) };
}
