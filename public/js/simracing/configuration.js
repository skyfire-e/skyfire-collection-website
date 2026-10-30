// One mounted wheel in the scene; the unused owned wheel stays in the catalog.
// Change configuration.installedWheel in simracing.json when the new wheel arrives.
export function wheelArrangement(variant) {
  if (!['gt-neo', 'neo-x', 'savu-pro'].includes(variant)) throw new Error(`Unknown steering wheel: ${variant}`);
  return { mounted: variant, spare: variant === 'neo-x' ? 'gt-neo' : 'neo-x' };
}

export function isOwnedWheel(catalog, variant) {
  return variant === catalog.configuration.installedWheel || catalog.configuration.ownedWheels.includes(variant);
}

export function resolveEquipment(catalog, variant = catalog.configuration.installedWheel) {
  const layout = wheelArrangement(variant);
  return catalog.items.map((item) => {
    const key = item.id === 'installed-wheel' ? layout.mounted : item.id === 'spare-wheel' ? layout.spare : null;
    if (!key) return item;
    const wheel = catalog.wheelVariants[key];
    if (!wheel) throw new Error(`Unknown steering wheel: ${key}`);
    const catalogOnly = item.id === 'spare-wheel';
    const placement = catalogOnly ? 'Alternate wheel — not fitted in this view. ' : 'Mounted in this view. ';
    return {
      ...wheel,
      id: item.id,
      catalogOnly,
      description:
        (!isOwnedWheel(catalog, key) ? 'Preview — not currently installed. ' : '') + placement + wheel.description
    };
  });
}

export function shouldShowHotspot(item, group) {
  if (item.catalogOnly) return false;
  return group === 'all' || item.group === group;
}

export function summarizeEquipment(items, group = 'all') {
  const listed = items.filter((item) => group === 'all' || item.group === group);
  const priced = listed.filter((item) => Number.isFinite(item.priceEur));
  return {
    count: listed.length,
    unpricedCount: listed.length - priced.length,
    totalEur: priced.reduce((cents, item) => cents + Math.round(item.priceEur * 100), 0) / 100
  };
}
