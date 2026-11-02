const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_TEST_DB = '1';
process.env.SESSION_SECRET = 'simracing-test-secret-at-least-32-characters';
const supertest = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const data = require('../public/data/simracing.json');

describe('Simracing collection integration', () => {
  it('adds the new section through migration and exposes the 3D page', async () => {
    assert.equal(db.getCategories().simracing.label, 'Simracing');
    const page = await supertest(app).get('/simracing');
    assert.equal(page.status, 200);
    assert.match(page.text, /id="canvas-host"/);
    assert.match(page.headers['content-security-policy'], /script-src 'self'/);
    const sitemap = await supertest(app).get('/sitemap.xml');
    assert.match(sitemap.text, /\/simracing<\/loc>/);
  });
  it('does not turn other categories into 3D pages or create unknown routes', async () => {
    db.saveCategories({ ...db.getCategories(), dice: { label: 'Dice', subcategories: [] } });
    assert.match((await supertest(app).get('/dice')).text, /section-pages.js/);
    assert.equal((await supertest(app).get('/nonexistent-rig')).status, 404);
  });
  it('keeps the special page tied to its admin-managed section', async () => {
    const categories = db.getCategories();
    const without = { ...categories };
    delete without.simracing;
    db.saveCategories(without);
    assert.equal((await supertest(app).get('/simracing')).status, 404);
    db.saveCategories(categories);
  });
  it('uses catalog prices first and retains owner fallbacks at the fixed conversion', () => {
    assert.equal(data.items.length, 28);
    assert.equal(new Set(data.items.map((item) => item.id)).size, 28);
    assert.equal(data.rate.date, '2026-10-30');
    assert.equal(data.rate.kind, 'fixed');
    assert.equal(data.rate.eurRub, 90);
    assert.equal(data.rate.eurRub * 25, 2250);
    assert.equal(data.items.filter((item) => item.priceType === 'catalog').length, 16);
    assert.equal(data.items.filter((item) => item.priceType === 'owner').length, 11);
    for (const item of data.items) {
      assert.ok(['Hardware', 'Cockpit', 'Usability'].includes(item.group));
      if (item.priceType === 'unconfirmed') {
        assert.equal(item.name, 'Simucube Savu Pro');
        assert.equal(item.priceEur, null);
        assert.equal(item.sourcePrice, null);
        assert.equal(item.priceCheckedAt, null);
        continue;
      }
      assert.ok(item.priceEur > 0);
      assert.ok(item.ownerPriceRub === null || item.ownerPriceRub > 0);
      assert.equal(item.priceCheckedAt, data.researchedAt);
      if (item.priceType === 'catalog') {
        assert.ok(item.sourceUrl.startsWith('https://'));
      } else {
        assert.equal(item.priceType, 'owner');
        assert.equal(item.sourceUrl, null);
        assert.equal(item.sourceCurrency, 'RUB');
        assert.equal(item.sourcePrice, item.ownerPriceRub);
      }
      {
        const multiplier =
          item.sourceCurrency === 'RUB'
            ? 1 / data.rate.eurRub
            : item.sourceCurrency === 'USD'
              ? data.rate.usdRub / data.rate.eurRub
              : 1;
        assert.ok(Math.abs(item.priceEur - item.sourcePrice * multiplier) < 0.011);
      }
    }
  });
  it('counts both shakers and does not replace verified listings with the owner amount', () => {
    const shakers = data.items.find((item) => item.id === 'shakers');
    assert.equal(shakers.sourceQuantity, 2);
    assert.equal(shakers.sourcePrice, shakers.sourceUnitPrice * 2);
    const frame = data.items.find((item) => item.id === 'frame');
    assert.equal(frame.sourcePrice, 73000);
    assert.equal(frame.ownerPriceRub, 81000);
    assert.equal(frame.priceEur, 811.11);
    assert.equal(data.items.find((item) => item.id === 'seat').priceEur, 222.22);
  });
  it('offers only Savu Pro and NEO X without reusing the removed GT Neo price', async () => {
    const { resolveEquipment } = await import('../public/js/simracing/configuration.js');
    assert.deepEqual(Object.keys(data.wheelVariants).sort(), ['neo-x', 'savu-pro']);
    assert.ok(!JSON.stringify(data).includes('GT-NEO'));
    const items = resolveEquipment(data);
    const wheel = items.find((item) => item.id === 'installed-wheel');
    assert.equal(wheel.name, 'Simucube Savu Pro');
    assert.equal(wheel.priceEur, null);
    assert.equal(wheel.priceType, 'unconfirmed');
    assert.deepEqual(
      data.wheelVariants['savu-pro'],
      data.items.find((item) => item.id === 'installed-wheel')
    );
    assert.doesNotMatch(wheel.description, /Preview/);
    assert.throws(() => resolveEquipment(data, 'gt-neo'), /Unknown steering wheel/);
    assert.throws(() => resolveEquipment(data, 'unknown'), /Unknown steering wheel/);
  });
  it('switches the mounted wheel while keeping the unused wheel in the catalog without a hotspot', async () => {
    const { resolveEquipment, isOwnedWheel, wheelArrangement, shouldShowHotspot } =
      await import('../public/js/simracing/configuration.js');
    const baseline = resolveEquipment(data);
    for (const variant of ['neo-x', 'savu-pro', 'neo-x']) {
      const items = resolveEquipment(data, variant);
      const layout = wheelArrangement(variant);
      assert.equal(items.length, 28);
      assert.equal(new Set(items.map((item) => item.id)).size, 28);
      for (const [slot, key] of [
        ['installed-wheel', layout.mounted],
        ['spare-wheel', layout.spare]
      ]) {
        const item = items.find((entry) => entry.id === slot);
        assert.equal(item.name, data.wheelVariants[key].name);
        assert.equal(item.priceEur, data.wheelVariants[key].priceEur);
        assert.equal(item.sourceUrl, data.wheelVariants[key].sourceUrl);
        assert.doesNotMatch(item.description, /Preview/);
        assert.equal(item.catalogOnly, slot === 'spare-wheel');
        assert.equal(shouldShowHotspot(item, 'all'), slot === 'installed-wheel');
        assert.doesNotMatch(item.description, /above the cockpit/);
      }
      const nonWheels = (list) => list.filter((item) => !['installed-wheel', 'spare-wheel'].includes(item.id));
      assert.deepEqual(nonWheels(items), nonWheels(baseline));
    }
    assert.equal(isOwnedWheel(data, 'neo-x'), true);
    assert.equal(isOwnedWheel(data, 'savu-pro'), true);
    assert.equal(data.configuration.installedWheel, 'savu-pro');
  });
  it('places the Co-Pedal to the driver’s left and ActivePedal Pro to the right', async () => {
    const THREE = await import('three');
    const { createPedals } = await import('../public/js/simracing/pedals.js');
    const { anchors } = createPedals(THREE);
    assert.ok(anchors['co-pedal'].x < anchors['active-ultimate'].x);
    assert.ok(anchors['active-ultimate'].x < anchors['active-pro'].x);
  });
  it('keeps the total stable when wheels swap and excludes the unknown Savu price', async () => {
    const { resolveEquipment, summarizeEquipment } = await import('../public/js/simracing/configuration.js');
    const total = summarizeEquipment(resolveEquipment(data));
    assert.deepEqual(total, { count: 28, unpricedCount: 1, totalEur: 9886.06 });
    assert.deepEqual(summarizeEquipment(resolveEquipment(data, 'neo-x')), total);
    assert.deepEqual(summarizeEquipment(resolveEquipment(data, 'savu-pro')), {
      count: 28,
      unpricedCount: 1,
      totalEur: 9886.06
    });
    assert.deepEqual(summarizeEquipment(resolveEquipment(data), 'Usability'), {
      count: 3,
      unpricedCount: 0,
      totalEur: 269.4
    });
    assert.deepEqual(summarizeEquipment([{ priceEur: 0.1 }, { priceEur: 0.2 }, { priceEur: null }]), {
      count: 3,
      unpricedCount: 1,
      totalEur: 0.3
    });
    assert.deepEqual(summarizeEquipment([]), { count: 0, unpricedCount: 0, totalEur: 0 });
  });
  it('shows every fitted component regardless of price while preserving category filters', async () => {
    const { shouldShowHotspot, resolveEquipment } = await import('../public/js/simracing/configuration.js');
    const items = resolveEquipment(data);
    assert.equal(items.filter((item) => shouldShowHotspot(item, 'all')).length, 27);
    for (const item of items) {
      assert.equal(shouldShowHotspot(item, 'all'), !item.catalogOnly);
      assert.equal(shouldShowHotspot(item, item.group), !item.catalogOnly);
      const otherGroup = item.group === 'Hardware' ? 'Cockpit' : 'Hardware';
      assert.equal(shouldShowHotspot(item, otherGroup), false);
    }
    for (const id of ['buttonbox', 'velcro', 'usb']) {
      const item = items.find((entry) => entry.id === id);
      assert.ok(item);
      assert.equal(shouldShowHotspot(item, 'all'), true);
      assert.equal(shouldShowHotspot({ ...item, priceEur: null }, 'all'), true);
    }
    const savu = resolveEquipment(data, 'savu-pro').find((item) => item.id === 'installed-wheel');
    assert.equal(savu.priceEur, null);
    assert.equal(shouldShowHotspot(savu, 'all'), true);
    assert.ok(!data.items.some((item) => item.id === 'booster-plate'));
    assert.equal(data.items.find((item) => item.id === 'pedal-plate').name, 'Simucube Baseplate');
  });
  it('uses the collection navigation and serves all component modules locally', async () => {
    const page = await supertest(app).get('/simracing');
    for (const script of ['/js/nav.js', '/js/auth.js', '/js/theme-init.js']) assert.ok(page.text.includes(script));
    assert.ok(!page.text.includes('Built to feel'));
    for (const file of ['seat', 'pedals', 'wheels', 'headset', 'configuration', 'selection', 'touch-controls']) {
      const module = await supertest(app).get(`/js/simracing/${file}.js`);
      assert.equal(module.status, 200);
      assert.match(module.headers['content-type'], /javascript/);
    }
  });
  it('resolves every physical catalog entry to distinct highlight meshes and follows wheel swaps', async () => {
    const THREE = await import('three');
    const { createCockpit } = await import('../public/js/simracing/model.js');
    const { resolveEquipment } = await import('../public/js/simracing/configuration.js');
    const previousDocument = globalThis.document;
    // Geometry tests do not rasterize labels, but the model still creates canvas textures.
    const context = new Proxy(
      {},
      {
        get(_, key) {
          if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
          if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
          return () => {};
        },
        set() {
          return true;
        }
      }
    );
    globalThis.document = { createElement: () => ({ getContext: () => context }) };
    try {
      const rig = createCockpit(THREE);
      const assigned = new Set();
      for (const item of resolveEquipment(data).filter((item) => !item.catalogOnly)) {
        const meshes = rig.getComponentMeshes(item.id);
        assert.ok(meshes.length > 0, `${item.id} has no highlight geometry`);
        for (const mesh of meshes) {
          assert.ok(!assigned.has(mesh), `${item.id} shares a highlighted mesh with another component`);
          assigned.add(mesh);
        }
      }
      assert.deepEqual(rig.getComponentMeshes('spare-wheel'), []);
      assert.deepEqual(rig.getComponentMeshes(null), []);
      const headset = rig.getComponentMeshes('vr-headset');
      const hooks = rig.getComponentMeshes('hooks');
      assert.ok(headset.some((mesh) => mesh.name === 'Pimax tether to cockpit cable routing'));
      rig.setHeadsetVisible(false);
      assert.equal(rig.isComponentVisible('vr-headset'), false);
      assert.deepEqual(rig.getComponentMeshes('vr-headset'), []);
      assert.deepEqual(rig.getComponentMeshes('hooks'), hooks);
      for (const mesh of headset) {
        let object = mesh;
        while (object && object.visible) object = object.parent;
        assert.ok(object, 'Headset and tether must actually leave the rendered scene');
      }
      const base = rig.getComponentMeshes('wheelbase');
      let previousWheel = rig.getComponentMeshes('installed-wheel');
      for (const variant of ['neo-x', 'savu-pro', 'neo-x']) {
        rig.setWheel(variant);
        const wheel = rig.getComponentMeshes('installed-wheel');
        assert.ok(wheel.length > 0);
        assert.ok(wheel.every((mesh) => !previousWheel.includes(mesh)));
        assert.deepEqual(rig.getComponentMeshes('wheelbase'), base);
        assert.equal(rig.isComponentVisible('vr-headset'), false, 'Wheel changes must preserve the VR toggle');
        previousWheel = wheel;
      }
      rig.setHeadsetVisible(true);
      assert.equal(rig.isComponentVisible('vr-headset'), true);
      assert.deepEqual(rig.getComponentMeshes('vr-headset'), headset);
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  });
  it('tints only selected meshes and restores shared materials when selection changes', async () => {
    const THREE = await import('three');
    const { createSelectionTint } = await import('../public/js/simracing/selection.js');
    const texture = new THREE.Texture();
    const shared = new THREE.MeshStandardMaterial({ color: '#343a42', map: texture, metalness: 0.42, roughness: 0.43 });
    const originalColor = shared.color.clone();
    const a = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const b = new THREE.Mesh(a.geometry, shared);
    const tint = createSelectionTint(new THREE.Color('#19c76b'));
    let disposedCopy = false;
    let disposedTexture = false;
    texture.addEventListener('dispose', () => {
      disposedTexture = true;
    });
    tint.set([a]);
    const tinted = a.material;
    tinted.addEventListener('dispose', () => {
      disposedCopy = true;
    });
    assert.notEqual(tinted, shared);
    assert.ok(!tinted.color.equals(originalColor));
    assert.equal(tinted.map, texture);
    assert.equal(tinted.metalness, shared.metalness);
    assert.equal(tinted.roughness, shared.roughness);
    assert.equal(b.material, shared);
    assert.ok(shared.color.equals(originalColor));
    tint.set([b]);
    assert.equal(a.material, shared);
    assert.equal(disposedCopy, true);
    assert.notEqual(b.material, shared);
    tint.clear();
    assert.equal(b.material, shared);
    const materialArray = [shared, shared];
    a.material = materialArray;
    tint.set([a]);
    assert.notEqual(a.material, materialArray);
    tint.clear();
    assert.equal(a.material, materialArray);
    assert.ok(shared.color.equals(originalColor));
    assert.equal(disposedTexture, false);
    a.geometry.dispose();
    shared.dispose();
    texture.dispose();
  });
  it('serves the outline pipeline and each of its local imports without relaxing the CSP', async () => {
    for (const file of [
      'EffectComposer',
      'RenderPass',
      'OutlinePass',
      'OutputPass',
      'ShaderPass',
      'MaskPass',
      'Pass',
      'CopyShader',
      'OutputShader'
    ]) {
      const response = await supertest(app).get(`/vendor/three/${file}.js`);
      assert.equal(response.status, 200);
      for (const [, source] of response.text.matchAll(/^import[\s\S]*?from ['"]([^'"]+)['"]/gm)) {
        assert.ok(source.startsWith('./'), `${file}: non-local import ${source}`);
        assert.equal((await supertest(app).get(`/vendor/three/${source.slice(2)}`)).status, 200);
      }
    }
  });
});
