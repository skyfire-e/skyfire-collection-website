# AGENTS.md — Simracing showroom

A local, self-hosted Three.js exhibit inside the existing Express collection.
**Preserve the self-only CSP and the existing category and gallery behavior.**

## Purpose

Render the owner's photographed cockpit as a rotatable approximation with
small hotspots, reference prices and a keyboard-accessible equipment catalog.
The public interface is entirely English and intentionally light gray.

## Architecture

- `page.js` — compact equipment rows, filters, detail selection and wheel switching.
- `viewer.js` — Three scene, camera, DOM markers and OutlinePass selection rendering.
- `touch-controls.js` — cooperative two-finger rotation/pinch; one-finger native scrolling.
- `selection.js` — resolve meshes by `userData.componentId` and manage temporary tint materials.
- `model.js` — original procedural geometry and named anchors, independent of UI.
- `../../data/simracing.json` — all names, prices, source links and exchange rates.
- `seat.js`, `pedals.js`, `wheels.js`, `headset.js` — detailed original component geometry.
- `configuration.js` — wheel slot resolution, hotspot visibility policy and price totals.
- `../../simracing.html`, `../../css/simracing.css` — dedicated page and styling.

## Decisions

- Coordinates are metres: X is driver's right, Y up, negative Z toward pedals.
- Each scene component ID matches an anchor returned by `createCockpit(THREE)`.
  Catalog-only equipment has `catalogOnly: true` and no mesh, anchor or hotspot.
- Each physical catalog ID must resolve to its own meshes via `getComponentMeshes`.
  Set `userData.componentId` while constructing meshes; imported modules tag their
  own components. Wheel children inherit the mounted slot tag, so swaps cannot
  leave the outline on detached geometry. Keep seat/harness, individual pedals,
  wheelbase/QR and shifter base/handle selections separate.
- Selection from a row scrolls to the showroom, resets to Overview and outlines
  that component green with a subtle matching material tint. Tint temporary clones
  only: rig materials are shared. Preserve textures and restore original material
  references when clearing or changing selection; dispose only the tint clones.
  Hotspot selection keeps the camera angle. Closing details
  or Escape clears the outline and returns focus. Selecting the catalog-only spare
  wheel fits it temporarily and highlights the installed slot.
- Markers render above the canvas and are never culled by model occlusion or by
  proximity to other markers. Only explicit filters, the points toggle, VR
  visibility and the camera viewport may hide them. A low-price row can still select its component.
- The wheel selector and VR headset toggle belong to the right of the Equipment
  heading, replacing the component count; camera controls remain on the scene.
  Inventory uses full-width rows.
  On phones details flow below the scene, keeping the selected geometry visible.
- Wheel/trackpad input scrolls the page, never zooms the rig. Scene zoom uses
  the accessible 44 px +/− buttons at the top right, bounded by the current
  camera preset's distance limits. OrbitControls handles mouse/pen only, with
  enableZoom false. Restore canvas touch-action to `auto` after its constructor.
  A scene-level touch handler claims two contacts before movement for orbit/pinch;
  single-finger scrolling remains native in every direction. Never reclaim an
  already-started scroll or a non-cancelable gesture. After one finger lifts,
  finish the gesture without switching to page scrolling or opening a hotspot.
  Scope listeners to the scene (including its hotspots), not the page/buttons;
  native browser pinch zoom outside the scene must remain available.
  Coarse-pointer and narrow layouts show the short corner hint `2 fingers to rotate`.
- All current components use original geometry. The generic CC0 seat was
  replaced by a photo-based BRIDE Low Max model with OMP harness.
- `configuration.installedWheel` selects a `wheelVariants` entry. The stable
  `installed-wheel` slot accepts Savu Pro (default) or NEO X-330R. GT-NEO is
  removed from the catalog, switcher and model factory. The unused owned
  wheel remains in the catalog as `spare-wheel`; never float it in the scene.
  `configuration.ownedWheels` distinguishes owned alternatives from previews.
  Do not change the wheelbase when switching rims.
- Savu Pro has no confirmed price yet: keep its price null and exclude it from
  the subtotal in either wheel slot. Do not inherit the removed GT-NEO price.
- All three photographed pedal faces are solid. Ultimate has a shorter rear
  housing with an open sensor window and exposed front guide rods.
- The fixed coiled steering cable belongs to frame wiring, outside the swappable
  wheel group. LCD key faces use unlit textures so studio reflections do not
  wash out their icons; selection tint still applies to these materials.
- Pedal order from the driver's left is Co-Pedal, Ultimate, Pro; move matching
  anchors with geometry. Fosi sits on the front shelf beneath the Link Hub;
  ACASIS is on the same rail farther toward the pedals. HBP sits beside AB9.
- Ulanzi, keyboard and DIMSIM box mounts must form continuous supports from
  their backplates/trays to the frame. Ulanzi and DIMSIM box flank the wheelbase;
  keep the box ahead of the shifter so its lever remains accessible. DIMSIM
  hooks attach to the seat's left hinge. Keep the narrowed crown trim continuous.
  Move the keyboard, its complete support and both hotspots together using
  `keyboardOffsetZ`; the tray is now beside the wheelbase at Z -.06. The right
  hardware rail ends at Z -.235 at the shifter tray, without an unused extension
  toward the pedals. DIMSIM and Ulanzi use slotted plates, transverse hinges and
  hand knobs mounted directly to the wheel uprights, not tall posts from the
  lower rails. `controlsOffsetZ` moves the MOZA tray and its hotspots 12 cm
  toward the seat; the button box follows this offset while its clamp stays on
  the wheel upright. `devicesOffsetZ` slides only AB9, HBP, their fasteners and
  hotspots another 8 cm toward the seat on that fixed tray. Keep the tray and
  button box stationary when adjusting this device offset. Shorten the button
  mount cantilever instead of moving its clamp off the profile. Ulanzi sits at
  Y .85 on a short tilt bracket; keep it connected and clear of the keyboard.
- The Simucube Baseplate is elevated on four perforated SIMART risers bolted to
  the top of the main rails, with transverse adapters under the narrower tray.
  Keep mounting hardware tagged `pedal-mount` and the Baseplate's own side cheeks
  tagged `pedal-plate`. Derive pedal hotspots from the tray's transform.
- Owner close-ups show short camera tilt heads on flat offset plates behind
  DIMSIM/Ulanzi, top-edge dock ports, four-panel stitched AB9 leather, 120 mm
  uprights and small swivel casters. `cameraMount` derives supports from the
  unchanged device poses; do not replace them with long floating struts.
- Rear shoulder belts loop through snap hooks and vertical eye bolts threaded
  into the TOP of the rear crossmember (Y .195 / Z .68). Preserve clearance over
  the front cushions when changing the belt paths.
- Lap belts clip to vertical eye bolts in the TOP slots of the side rails at
  X ±.29 / Z .565 (rail top Y .215). Use stamped snap hooks with open webbing
  slots, spring gates and folded strap ends; do not leave the lower ends floating.
  Lap belts wrap outside and over the hip bolsters before reaching the buckle.
  Check the full ribbon width against the cushion meshes; a clear centreline
  alone can still leave the strap edges buried in the upholstery.
- The Sounderlink pair has one shaker under the pedals (Z -.61), one under the
  seat (Z .61). The front uses an 18 cm wide longitudinal bridge from the
  FRONT crossmember at Z -.77 (top Y .195), extending rearward with two
  underside gussets. There is no extra frame crossmember at Z -.46;
  never span it across the longitudinal rails. The rear plate fastens under
  the seat runners and stays clear of the lap-belt eye bolts.
  Keep both under the shared `shakers` selection and its front anchor.
- Pimax Crystal Light hangs nose-down by its rear headband on the two DIMSIM
  seat hooks. Keep the cradle on the hooks, the retaining tips outside the pad,
  and the visor clear of the seat and lap belts. Its cable returns to the rail.
  The headset has its own `vr-headset` hotspot and catalog entry; no owner price
  was provided, so `ownerPriceRub` stays null.
- Public wheel previews are transient; never persist them as owned equipment.
- VR Off hides the Pimax AND its tether, hotspot and selection geometry, while
  preserving the seat hooks, catalog entry and Summary. Wheel swaps and filters
  preserve this state. Selecting its catalog row reveals it and sets VR On.
  The whole headset/tether assembly shares one parent with toggled visibility.
- NEO X-330R uses a 330 mm leather rim with inward thumb swells, red centre marker
  and inner cross-stitching, three brushed-metal spokes, the shaped forged-carbon
  hub, eight buttons, nine RPM segments and two lower encoders. Reference:
  https://simagic.com/products/simagic-neo-x-series-steering-wheels
- All physically fitted components have hotspots, regardless of price or price
  availability. Only catalog-only equipment, category filters and the global
  points toggle (or VR Off for the headset) can exclude an item; do not restore a price threshold.
- Prefer verified exact catalog listings; use the supplied `ownerPriceRub` as
  fallback when the exact product or bundle cannot be identified. Preserve the
  baseline even when a catalog price wins. `priceType` and `sourceLabel` expose
  this distinction in the public UI; owner fallbacks have no catalog source URL.
- Price `null` means unknown, never zero. Show the listing's source, tax/bundle
  caveats and snapshot date. Do not imply these are the owner's purchase prices.
- EUR/RUB is owner-defined and fixed at 90, not a CBR quote. USD listings use
  the dated CBR USD/RUB snapshot, then divide by 90. Preserve this explicit
  distinction and recompute prices from sourceCurrency/sourcePrice.
- All components remain available in the list, with no public price/unpriced
  controls. Summary below the list totals the
  current category in EUR and RUB, including the catalog-only alternate wheel
  once. Sum integer cents; unknown prices are excluded and explicitly counted.
  Refresh totals when filtering or switching wheels. Keep provenance in item
  details, without a separate model/price sources disclosure.
- Catalog data is edited in JSON; the existing admin item editor does not edit it.
- DB migration v5 adds the normal `simracing` section; the special page still
  requires that section to exist. Category deletion should keep working.
- Three modules are generated by `npm run vendor:three` during postinstall.
  The local OutlinePass pipeline includes RenderPass and OutputPass to preserve
  tone mapping and color space. Render directly when there is no selection.
  Change the vendor preparation script if adding an addon; avoid CDN imports.
- Verify desktop and phone layouts, drag/zoom, cards, filtering, and graceful
  WebGL failure. Run `npm run ci` for backend integration and source validation.
