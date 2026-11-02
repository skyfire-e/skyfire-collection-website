import {
  resolveEquipment,
  shouldShowHotspot,
  isOwnedWheel,
  wheelArrangement,
  summarizeEquipment
} from './configuration.js';
const $ = (id) => document.getElementById(id);
const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroExact = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
const ruble = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const date = (value) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`)
  );
const priceLabel = (item) =>
  item.priceType === 'catalog' ? 'Catalog price' : item.priceType === 'owner' ? 'Owner-provided' : 'Price to confirm';
let viewer;
let selected = null;
let lastTrigger = null;
let group = 'all';
let showPoints = true;
let showHeadset = true;
let catalog;
let sourceCatalog;
const markers = new Map();
const rows = new Map();

function updateWheelStatus(variant) {
  $('wheel-status').textContent = isOwnedWheel(catalog, variant)
    ? `${catalog.wheelVariants[variant].name} fitted to the wheelbase`
    : 'Preview only · not installed yet';
}

function visibleItems() {
  return catalog.items.filter((item) => shouldShowHotspot(item, group));
}
function updateSummary() {
  const { count, unpricedCount, totalEur } = summarizeEquipment(catalog.items, group);
  $('summary-count').textContent =
    `${group === 'all' ? '' : `${group} · `}${count} ${count === 1 ? 'component' : 'components'}`;
  $('summary-label').textContent = unpricedCount ? 'Known-price subtotal' : 'Estimated total';
  $('summary-eur').textContent = `≈ ${euroExact.format(totalEur)}`;
  $('summary-rub').textContent = `≈ ${ruble.format(totalEur * catalog.rate.eurRub)}`;
  $('summary-note').hidden = unpricedCount === 0;
  $('summary-note').textContent = unpricedCount
    ? `${unpricedCount} ${unpricedCount === 1 ? 'component without a confirmed price is' : 'components without confirmed prices are'} excluded.`
    : '';
  $('equipment-summary').hidden = false;
}
function updateFilter() {
  const visible = new Set(visibleItems().map((item) => item.id));
  for (const [id, row] of rows)
    row.hidden = group !== 'all' && catalog.items.find((item) => item.id === id).group !== group;
  viewer?.setVisible(showPoints ? visible : new Set());
  if (selected && group !== 'all' && catalog.items.find((item) => item.id === selected)?.group !== group) closeDetail();
  updateSummary();
}
function closeDetail() {
  $('detail').hidden = true;
  for (const el of [...markers.values(), ...rows.values()]) {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  }
  selected = null;
  viewer?.select(null);
  if (lastTrigger?.isConnected) lastTrigger.focus({ preventScroll: true });
}
function selectItem(item, trigger) {
  // Selecting the headset in the catalog reveals it for inspection.
  if (item.id === 'vr-headset' && !showHeadset) setHeadsetVisible(true);
  // An alternate wheel has no floating mesh: fit it before highlighting it.
  if (item.catalogOnly && item.id === 'spare-wheel') {
    changeWheel(wheelArrangement($('wheel-variant').value).spare);
    item = catalog.items.find((entry) => entry.id === 'installed-wheel');
    trigger = rows.get('installed-wheel');
  }
  selected = item.id;
  lastTrigger = trigger;
  $('detail-group').textContent = item.group.toUpperCase();
  $('detail-name').textContent = item.name;
  $('detail-description').textContent = item.description;
  $('detail-price').textContent = item.priceEur === null ? 'Price to confirm' : `≈ ${euroExact.format(item.priceEur)}`;
  $('detail-rub').textContent =
    item.priceEur === null
      ? 'Exact model or listing needed'
      : `≈ ${ruble.format(item.sourceCurrency === 'RUB' ? item.sourcePrice : item.priceEur * catalog.rate.eurRub)}`;
  $('detail-provenance').textContent =
    item.priceType === 'owner'
      ? `Owner-provided · ${ruble.format(item.ownerPriceRub)} ÷ ${catalog.rate.eurRub}`
      : item.priceType === 'catalog'
        ? `Catalog · ${item.sourceLabel} · checked ${date(item.priceCheckedAt)}`
        : 'Price not yet confirmed';
  $('detail-note').textContent = item.priceNote;
  $('detail-source').hidden = !item.sourceUrl;
  if (item.sourceUrl) {
    $('detail-source').href = item.sourceUrl;
    $('detail-source').textContent = item.priceType === 'catalog' ? 'View catalog price ↗' : 'View product reference ↗';
  } else {
    $('detail-source').removeAttribute('href');
  }
  $('detail').hidden = false;
  for (const [id, el] of [...markers, ...rows]) {
    el.classList.toggle('selected', id === selected);
    el.setAttribute('aria-pressed', String(id === selected));
  }
  viewer?.select(item.id);
  if (trigger?.classList.contains('equipment-row')) {
    setView('overview');
    document
      .querySelector('.showroom')
      .scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('close-detail').focus({ preventScroll: true });
  }
}
function renderCatalog() {
  rows.clear();
  markers.clear();
  $('equipment-list').replaceChildren();
  $('hotspots').replaceChildren();
  const fragment = document.createDocumentFragment();
  catalog.items.forEach((item, index) => {
    const row = document.createElement('button');
    row.className = 'equipment-row';
    row.type = 'button';
    row.dataset.component = item.id;
    row.setAttribute('aria-pressed', 'false');
    row.setAttribute(
      'aria-label',
      `${item.name}, ${item.priceEur === null ? 'price to confirm' : euro.format(item.priceEur)}`
    );
    for (const [tag, className, text] of [
      ['span', 'part-num', String(index + 1).padStart(2, '0')],
      ['span', 'part-name', item.name],
      ['span', 'part-group', `${item.group} · ${item.catalogOnly ? 'Alternate wheel' : priceLabel(item)}`],
      [
        'span',
        `part-price${item.priceEur === null ? ' unpriced' : ''}`,
        item.priceEur === null ? 'Price to confirm' : `≈ ${euro.format(item.priceEur)}`
      ],
      ['span', 'part-arrow', '↑']
    ]) {
      const el = document.createElement(tag);
      el.className = className;
      el.textContent = text;
      row.append(el);
    }
    row.addEventListener('click', () => selectItem(item, row));
    rows.set(item.id, row);
    fragment.append(row);
    if (item.catalogOnly) return;
    const marker = document.createElement('button');
    marker.className = `hotspot${item.priceEur === null ? ' unknown' : ''}`;
    marker.dataset.component = item.id;
    marker.setAttribute('aria-pressed', 'false');
    marker.dataset.label = `${item.name}${item.priceEur === null ? '' : ` · ${euro.format(item.priceEur)}`}`;
    marker.setAttribute('aria-label', `Show ${item.name}`);
    marker.hidden = true;
    marker.addEventListener('click', () => selectItem(item, marker));
    markers.set(item.id, marker);
    $('hotspots').append(marker);
  });
  $('equipment-list').append(fragment);
}
function setHeadsetVisible(value) {
  showHeadset = value;
  if (!value && selected === 'vr-headset') closeDetail();
  $('headset-toggle').setAttribute('aria-pressed', String(value));
  $('headset-state').textContent = value ? 'On' : 'Off';
  viewer?.setHeadsetVisible(value);
}
$('headset-toggle').addEventListener('click', () => {
  setHeadsetVisible(!showHeadset);
  $('headset-toggle').focus({ preventScroll: true });
});
$('close-detail').addEventListener('click', closeDetail);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && selected) closeDetail();
});
document.querySelectorAll('[data-group]').forEach((button) =>
  button.addEventListener('click', () => {
    group = button.dataset.group;
    document.querySelectorAll('[data-group]').forEach((el) => {
      el.classList.toggle('active', el === button);
      el.setAttribute('aria-pressed', String(el === button));
    });
    updateFilter();
  })
);
$('points').addEventListener('click', () => {
  showPoints = !showPoints;
  $('points').setAttribute('aria-pressed', String(showPoints));
  updateFilter();
});
function setView(name) {
  viewer?.setView(name);
  document.querySelectorAll('[data-view]').forEach((el) => {
    el.classList.toggle('active', el.dataset.view === name);
    el.setAttribute('aria-pressed', String(el.dataset.view === name));
  });
}
document
  .querySelectorAll('[data-view]')
  .forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('rotate').addEventListener('click', () => {
  const enabled = $('rotate').getAttribute('aria-pressed') !== 'true';
  $('rotate').setAttribute('aria-pressed', String(enabled));
  viewer?.setRotate(enabled);
});
try {
  const response = await fetch('/data/simracing.json');
  if (!response.ok) throw new Error('Equipment catalog unavailable');
  sourceCatalog = await response.json();
  catalog = { ...sourceCatalog, items: resolveEquipment(sourceCatalog) };
  for (const [id, variant] of Object.entries(catalog.wheelVariants)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent =
      variant.name +
      (id === catalog.configuration.installedWheel
        ? ' (current)'
        : isOwnedWheel(catalog, id)
          ? ' (alternate)'
          : ' (preview)');
    option.selected = id === catalog.configuration.installedWheel;
    $('wheel-variant').append(option);
  }
  updateWheelStatus(catalog.configuration.installedWheel);
  renderCatalog();
  updateFilter();
  try {
    const { createViewer } = await import('./viewer.js');
    viewer = await createViewer(
      $('canvas-host'),
      markers,
      () => {
        $('fallback').hidden = false;
        for (const marker of markers.values()) marker.hidden = true;
      },
      catalog.configuration.installedWheel
    );
    updateFilter();
    if (selected) viewer.select(selected);
    $('wheel-variant').disabled = false;
    $('headset-toggle').disabled = false;
  } catch (error) {
    console.error('Cockpit viewer:', error);
    $('fallback').hidden = false;
    document
      .querySelectorAll('.view-controls button, .equipment-controls button, .equipment-controls select')
      .forEach((control) => (control.disabled = true));
  }
} catch (error) {
  $('equipment-list').textContent = 'The equipment list could not be loaded. Please reload the page.';
  $('fallback').hidden = false;
  console.error(error);
} finally {
  $('loading').hidden = true;
}

function changeWheel(variant) {
  $('wheel-variant').value = variant;
  if (selected) closeDetail();
  catalog.items = resolveEquipment(sourceCatalog, variant);
  renderCatalog();
  viewer?.setWheel(variant);
  updateFilter();
  updateWheelStatus(variant);
}

$('wheel-variant').addEventListener('change', () => {
  changeWheel($('wheel-variant').value);
  setView('driver');
  document
    .querySelector('.showroom')
    .scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
