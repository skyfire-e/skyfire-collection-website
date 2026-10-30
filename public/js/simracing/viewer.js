import * as THREE from '/vendor/three/three.module.js';
import { OrbitControls } from '/vendor/three/OrbitControls.js';
import { RoomEnvironment } from '/vendor/three/RoomEnvironment.js';
import { EffectComposer } from '/vendor/three/EffectComposer.js';
import { RenderPass } from '/vendor/three/RenderPass.js';
import { OutlinePass } from '/vendor/three/OutlinePass.js';
import { OutputPass } from '/vendor/three/OutputPass.js';
import { createCockpit } from './model.js';
import { createSelectionTint } from './selection.js';

export async function createViewer(host, markers, onContextLost, initialWheel = 'gt-neo') {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-label', '3D model of the sim racing cockpit');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = 0.85;
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 35);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 1.4;
  controls.maxDistance = 5.8;
  controls.maxPolarAngle = Math.PI / 2 - 0.035;
  controls.minPolarAngle = 0.13;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.65;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x92928a, 1.05));
  const key = new THREE.DirectionalLight(0xfffaf3, 2.7);
  key.position.set(-2.5, 5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 12 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.003;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xeaf1ff, 1.25);
  fill.position.set(3, 2, -4);
  scene.add(fill);
  const rig = createCockpit(THREE, initialWheel);
  scene.add(rig.group);
  // Outline the selected component's silhouette, including its occluded edges.
  const composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene, camera));
  const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
  outline.visibleEdgeColor.set('#19c76b');
  outline.hiddenEdgeColor.copy(outline.visibleEdgeColor);
  const selectionTint = createSelectionTint(outline.visibleEdgeColor);
  outline.edgeStrength = 4;
  outline.edgeThickness = 1.5;
  outline.edgeGlow = 0;
  composer.addPass(outline);
  composer.addPass(new OutputPass());
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.003;
  ground.receiveShadow = true;
  scene.add(ground);
  // Broad ambient contact shadow, generated locally rather than fetched as an image.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(35,40,30,.24)');
  gradient.addColorStop(1, 'rgba(35,40,30,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 2.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);
  let visible = new Set();
  let selected = null;
  let pending = false;
  let disposed = false;
  const projected = new THREE.Vector3();
  let width = 1,
    height = 1;
  let currentView = 'overview';
  function updateMarkers() {
    // DOM markers stay above the canvas. Neither model occlusion nor proximity
    // to another marker hides a component; only filters and the viewport do.
    for (const [id, marker] of markers) {
      const anchor = rig.anchors[id];
      if (!anchor || !visible.has(id) || !rig.isComponentVisible(id)) {
        marker.hidden = true;
        continue;
      }
      projected.copy(anchor).applyMatrix4(rig.group.matrixWorld).project(camera);
      const x = ((projected.x + 1) * width) / 2,
        y = ((1 - projected.y) * height) / 2;
      marker.hidden = projected.z < -1 || projected.z > 1 || x < 0 || x > width || y < 0 || y > height;
      if (!marker.hidden) {
        const position = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
        if (marker.style.translate !== position) marker.style.translate = position;
      }
    }
  }
  function updateSelection() {
    outline.selectedObjects = rig.getComponentMeshes(selected);
    selectionTint.set(outline.selectedObjects);
    // Expose useful state for accessibility and browser verification, not scene internals.
    host.dataset.selectedComponent = selected || '';
    host.dataset.outlinedMeshes = String(outline.selectedObjects.length);
  }
  function requestRender() {
    if (!pending && !disposed && !document.hidden) {
      pending = true;
      requestAnimationFrame(render);
    }
  }
  function render() {
    pending = false;
    if (disposed || document.hidden) return;
    const changed = controls.update();
    if (outline.selectedObjects.length) composer.render();
    else renderer.render(scene, camera);
    updateMarkers();
    if (changed || controls.autoRotate) requestRender();
  }
  function setView(name = 'overview') {
    currentView = name;
    const mobile = width < 700;
    const views = {
      overview: [2.9, 2.25, -2.65],
      side: [3.6, 1.35, 0.15],
      front: [-0.9, 1.35, -1.25],
      driver: [0, 1.12, 0.36]
    };
    camera.position.fromArray(views[name] || views.overview);
    const targets = {
      overview: [0, 0.57, -0.02],
      side: [0, 0.58, -0.05],
      front: [0, 0.44, -0.6],
      driver: [0, 0.835, 0.01]
    };
    controls.target.fromArray(targets[name] || targets.overview);
    const direction = camera.position.clone().sub(controls.target);
    const closeup = name === 'front' || name === 'driver';
    // Fit the 330 mm alternate rim and its point inside a portrait viewport.
    const driverDistance = Math.max(
      0.47,
      0.4 / (2 * Math.tan(THREE.MathUtils.degToRad(55) / 2) * camera.aspect) + 0.06
    );
    const distance =
      name === 'driver' ? driverDistance : mobile ? (closeup ? 1.5 : width < 450 ? 4.3 : 3.5) : closeup ? 1.4 : 3.4;
    camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance));
    controls.minDistance = name === 'driver' ? 0.3 : closeup ? 0.65 : 1.4;
    camera.fov = name === 'driver' ? 55 : mobile ? 43 : 34;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
  }
  function resize() {
    const changedBreakpoint = width < 700 !== host.clientWidth < 700;
    width = host.clientWidth;
    height = host.clientHeight;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    // A wider vertical field of view keeps the full rig visible on narrow phones.
    camera.fov = currentView === 'driver' ? 55 : width < 700 ? 43 : 34;
    camera.updateProjectionMatrix();
    if (changedBreakpoint || currentView === 'driver') setView(currentView);
    requestRender();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  setView();
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    document.getElementById('rotate').setAttribute('aria-pressed', 'false');
  });
  document.addEventListener('visibilitychange', requestRender);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    disposed = true;
    selectionTint.clear();
    onContextLost();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
  host.dataset.model = 'ready';
  host.dataset.headsetVisible = 'true';
  requestRender();
  return {
    setHeadsetVisible(value) {
      rig.setHeadsetVisible(value);
      if (!value && selected === 'vr-headset') selected = null;
      host.dataset.headsetVisible = String(value);
      updateSelection();
      requestRender();
    },
    setWheel(variant) {
      rig.setWheel(variant);
      updateSelection();
      requestRender();
    },
    setVisible(ids) {
      visible = ids;
      requestRender();
    },
    select(id) {
      selected = id;
      updateSelection();
      requestRender();
    },
    setView,
    setRotate(value) {
      controls.autoRotate = value;
      requestRender();
    }
  };
}
