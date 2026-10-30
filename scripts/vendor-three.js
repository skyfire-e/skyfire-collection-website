// Keep browser modules local to preserve the site's self-only CSP and offline use.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules/three');
const target = path.join(root, 'public/vendor/three');
fs.mkdirSync(target, { recursive: true });
for (const name of ['three.module.js', 'three.core.js']) {
  fs.copyFileSync(path.join(source, 'build', name), path.join(target, name));
}
for (const [folder, name] of [
  ['controls', 'OrbitControls'],
  ['environments', 'RoomEnvironment'],
  ...['EffectComposer', 'RenderPass', 'OutlinePass', 'OutputPass', 'ShaderPass', 'MaskPass', 'Pass'].map((name) => [
    'postprocessing',
    name
  ]),
  ...['CopyShader', 'OutputShader'].map((name) => ['shaders', name])
]) {
  const code = fs.readFileSync(path.join(source, 'examples/jsm', folder, name + '.js'), 'utf8');
  fs.writeFileSync(
    path.join(target, name + '.js'),
    code.replace(/from 'three'/g, "from './three.module.js'").replace(/from '\.\.\/shaders\//g, "from './")
  );
}
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
console.log('Local Three.js browser modules prepared.');
