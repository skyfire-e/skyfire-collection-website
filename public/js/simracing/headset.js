/** Original Pimax Crystal Light study, based on the manufacturer's product photos.
 * Approximate metres; local X spans the visor, Y is up, -Z faces forward.
 * No manufacturer mesh or product image is embedded in the scene.
 */
export function createHeadset(THREE) {
  const group = new THREE.Group();
  group.name = 'Pimax Crystal Light';
  const housing = new THREE.MeshStandardMaterial({ color: 0x353944, roughness: 0.48, metalness: 0.18 });
  const panel = new THREE.MeshStandardMaterial({ color: 0x191d24, roughness: 0.4, metalness: 0.14 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x13161b, roughness: 0.96 });
  const band = new THREE.MeshStandardMaterial({ color: 0x262931, roughness: 0.85, side: THREE.DoubleSide });
  const silver = new THREE.MeshStandardMaterial({ color: 0xcbd2dd, roughness: 0.44, metalness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x344a7b, roughness: 0.12, metalness: 0.38, clearcoat: 1 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0x515c9b, roughness: 0.13, metalness: 0.3, clearcoat: 1 });
  const vector = (point) => new THREE.Vector3(...point);
  function add(geometry, material, position, name) {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function outline(points) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    return shape;
  }
  function prism(points, depth, z, material, name, bevel = 0.002) {
    const geometry = new THREE.ExtrudeGeometry(outline(points), {
      depth,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 2,
      steps: 1
    });
    const positions = geometry.attributes.position;
    // The two visor wings recede from the centre ridge.
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, positions.getZ(i) + z + (0.022 * Math.abs(positions.getX(i))) / 0.134);
    }
    geometry.computeVertexNormals();
    return add(geometry, material, null, name);
  }
  function tube(points, radius, material, name, closed = false) {
    return add(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(vector), closed), 64, radius, 8, closed),
      material,
      null,
      name
    );
  }
  function strap(points, width, axis, material, name) {
    const curve = new THREE.CatmullRomCurve3(points.map(vector)),
      positions = [],
      indices = [];
    for (let i = 0; i <= 64; i++) {
      const point = curve.getPoint(i / 64),
        tangent = curve.getTangent(i / 64),
        across = vector(axis);
      across
        .addScaledVector(tangent, -across.dot(tangent))
        .normalize()
        .multiplyScalar(width / 2);
      positions.push(...point.clone().sub(across).toArray(), ...point.clone().add(across).toArray());
      if (i < 64) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return add(geometry, material, null, name);
  }
  function disc(radius, depth, position, material, name) {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, depth, 40), material, position, name);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
  const silhouette = [
    [-0.133, -0.04],
    [-0.105, -0.06],
    [-0.035, -0.047],
    [0, -0.032],
    [0.035, -0.047],
    [0.105, -0.06],
    [0.133, -0.04],
    [0.13, 0.035],
    [0.108, 0.057],
    [0.025, 0.066],
    [0, 0.062],
    [-0.025, 0.066],
    [-0.108, 0.057],
    [-0.13, 0.035]
  ];
  prism(silhouette, 0.085, -0.15, housing, 'Angular visor housing');
  for (const side of [-1, 1]) {
    prism(
      [
        [side * 0.006, -0.027],
        [side * 0.101, -0.05],
        [side * 0.112, -0.042],
        [side * 0.112, 0.039],
        [side * 0.102, 0.049],
        [side * 0.006, 0.053]
      ],
      0.002,
      -0.154,
      panel,
      'Faceted removable faceplate',
      0.001
    );
    strap(
      [
        [side * 0.095, 0.032, -0.156 + (0.022 * 0.095) / 0.134],
        [0, 0.006, -0.156]
      ],
      0.003,
      [0, 1, 0],
      silver,
      'Silver visor chevron'
    );
    for (const [x, y] of [
      [side * 0.122, 0.037],
      [side * 0.051, -0.05]
    ]) {
      const z = -0.15 + (0.022 * Math.abs(x)) / 0.134;
      disc(0.0075, 0.004, [x, y, z - 0.004], rubber, 'Tracking camera bezel');
      disc(0.0044, 0.001, [x, y, z - 0.0065], glass, 'Tracking camera lens');
    }
    for (let i = 0; i < 7; i++) {
      const x = side * (0.028 + i * 0.005);
      add(
        new THREE.BoxGeometry(0.002, 0.006, 0.001),
        rubber,
        [x, 0.058, -0.151 + (0.022 * Math.abs(x)) / 0.134],
        'Visor cooling vent'
      );
    }
    const hinge = disc(0.015, 0.009, [side * 0.126, 0.013, -0.047], panel, 'Headband hinge');
    hinge.rotation.set(0, 0, Math.PI / 2);
    strap(
      [
        [side * 0.126, 0.017, -0.05],
        [side * 0.113, 0.019, 0.027],
        [side * 0.096, 0.02, 0.106],
        [side * 0.058, 0.015, 0.142]
      ],
      0.025,
      [0, 1, 0],
      band,
      'Rigid headband arm'
    );
    tube(
      [
        [side * 0.112, 0.015, 0.026],
        [side * 0.118, -0.013, 0.028],
        [side * 0.12, -0.033, 0.032]
      ],
      0.005,
      housing,
      'Speaker support'
    );
    const speaker = add(new THREE.SphereGeometry(1, 24, 16), panel, [side * 0.12, -0.033, 0.034], 'Off-ear speaker');
    speaker.scale.set(0.009, 0.023, 0.019);
    disc(0.03, 0.006, [side * 0.035, 0, -0.041], rubber, 'Aspheric lens bezel');
    disc(0.026, 0.007, [side * 0.035, 0, -0.037], lens, 'Aspheric glass lens');
  }
  const facialFoam = tube(
    [
      [-0.102, -0.029, -0.037],
      [-0.108, 0.019, -0.032],
      [-0.075, 0.047, -0.028],
      [0, 0.051, -0.024],
      [0.075, 0.047, -0.028],
      [0.108, 0.019, -0.032],
      [0.102, -0.029, -0.037],
      [0.045, -0.036, -0.029],
      [0.023, -0.014, -0.026],
      [0, -0.01, -0.026],
      [-0.023, -0.014, -0.026],
      [-0.045, -0.036, -0.029]
    ],
    0.0075,
    rubber,
    'Pimax Facial Foam 15mm',
    true
  );
  facialFoam.userData.componentId = 'vr-foam';
  strap(
    [
      [0, 0.06, -0.059],
      [0, 0.116, -0.01],
      [0, 0.119, 0.062],
      [0, 0.039, 0.143]
    ],
    0.034,
    [1, 0, 0],
    band,
    'Woven top strap'
  );
  // The comfort accessory bridges the two rigid side arms; the original
  // longitudinal webbing stays part of the headset itself.
  const comfortArch = [
    [-0.113, 0.019, 0.027],
    [-0.087, 0.083, 0.027],
    [0, 0.132, 0.027],
    [0.087, 0.083, 0.027],
    [0.113, 0.019, 0.027]
  ];
  const topSupport = strap(comfortArch, 0.052, [0, 0, 1], band, 'Comfort Top Strap support');
  topSupport.userData.componentId = 'vr-topstrap';
  const topPadding = strap(
    comfortArch.map(([x, y, z]) => [x * 0.98, y - 0.005, z]),
    0.046,
    [0, 0, 1],
    rubber,
    'Comfort Top Strap padding'
  );
  topPadding.userData.componentId = 'vr-topstrap';
  for (const side of [-1, 1]) {
    const attachment = disc(0.012, 0.007, [side * 0.113, 0.019, 0.027], panel, 'Comfort Top Strap attachment');
    attachment.rotation.set(0, 0, Math.PI / 2);
    attachment.userData.componentId = 'vr-topstrap';
  }
  // The rear headband rests on the two DIMSIM hooks. Crystal Light has no rear battery.
  const pad = add(new THREE.BoxGeometry(0.13, 0.055, 0.028, 4, 2, 2), panel, [0, 0.015, 0.14], 'Rear headband cradle');
  const padPositions = pad.geometry.attributes.position;
  for (let i = 0; i < padPositions.count; i++) {
    const x = padPositions.getX(i);
    padPositions.setZ(i, padPositions.getZ(i) - 0.008 * (x / 0.065) ** 2);
  }
  pad.geometry.computeVertexNormals();
  disc(0.022, 0.014, [0, 0.015, 0.162], housing, 'Rear fit adjustment dial');
  disc(0.017, 0.001, [0, 0.015, 0.17], panel, 'Rear dial cap');
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    const grip = add(
      new THREE.BoxGeometry(0.002, 0.004, 0.011),
      rubber,
      [0.022 * Math.cos(angle), 0.015 + 0.022 * Math.sin(angle), 0.162],
      'Dial grip'
    );
    grip.rotation.z = angle - Math.PI / 2;
  }
  add(new THREE.BoxGeometry(0.018, 0.012, 0.024), rubber, [-0.12, 0.023, -0.035], 'DisplayPort cable connector');
  group.userData.cablePoint = new THREE.Vector3(-0.133, 0.023, -0.03);
  group.userData.hotspot = new THREE.Vector3(0, 0.075, -0.1);
  group.userData.accessoryAnchors = {
    'vr-foam': new THREE.Vector3(-0.103, 0.035, -0.022),
    'vr-topstrap': new THREE.Vector3(0.065, 0.112, 0.027)
  };
  return group;
}
