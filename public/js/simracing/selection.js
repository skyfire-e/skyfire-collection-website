// Resolve mesh ownership, including dynamically replaced children in the wheel slot.
// A component's own tag takes precedence over a tagged ancestor.
export function componentMeshes(root, id) {
  if (!id) return [];
  const meshes = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    let owner = object;
    while (owner && !owner.userData.componentId) owner = owner.parent;
    if (owner?.userData.componentId === id) meshes.push(object);
  });
  return meshes;
}

// Materials are shared throughout the rig. Tint temporary copies so selecting
// one component never recolors its neighbours or changes the original textures.
export function createSelectionTint(color, strength = 0.16) {
  const originals = new Map();
  const copies = new Map();
  function clear() {
    for (const [mesh, material] of originals) mesh.material = material;
    originals.clear();
    for (const material of copies.values()) material.dispose();
    copies.clear();
  }
  function tinted(material) {
    if (!material.color) return material;
    if (!copies.has(material)) {
      const copy = material.clone();
      copy.color.lerp(color, strength);
      copies.set(material, copy);
    }
    return copies.get(material);
  }
  return {
    clear,
    set(meshes) {
      clear();
      for (const mesh of new Set(meshes)) {
        originals.set(mesh, mesh.material);
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tinted) : tinted(mesh.material);
      }
    }
  };
}
