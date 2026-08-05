// Shared modal markup (auth, edit item, crop, lightbox) — single source of truth.
// injectAuthModal() is called by nav.js on every page (nav.js loads first, so the
// modal exists before auth.js queries the DOM). Edit/crop/lightbox are injected by
// gallery-page.js (gallery + subgroup pages) and admin/items.js, so the same dialog
// no longer has to be maintained in several HTML files.
// Pages that only edit items (admin) skip the lightbox via { lightbox: false }.
// Markup is static (no user data) — innerHTML is safe here, same as nav.js.

const AUTH_MODAL_HTML = `
<div class="modal-overlay" id="authModal" role="dialog" aria-modal="true" aria-label="Admin login">
  <div class="modal">
    <h2 id="authTitle">Admin Login</h2>
    <div class="form-group">
      <label for="loginUsername">Username</label>
      <input type="text" id="loginUsername" placeholder="admin">
    </div>
    <div class="form-group">
      <label for="loginPassword">Password</label>
      <input type="password" id="loginPassword" placeholder="Password">
    </div>
    <div class="btn-row">
      <button class="btn" id="loginBtn">Login</button>
      <button class="btn btn-danger hidden" id="logoutBtn">Logout</button>
    </div>
    <p id="authError" class="danger-text" role="alert" aria-live="polite"></p>
  </div>
</div>`;

const EDIT_MODAL_HTML = `
<div class="modal-overlay" id="editModal" role="dialog" aria-modal="true" aria-label="Edit item">
  <div class="modal modal-wide">
    <h2>Edit Item</h2>
    <input type="hidden" id="editId">
    <div class="form-group">
      <label for="editSection">Section</label>
      <select id="editSection"></select>
    </div>
    <div class="form-group">
      <label for="editCategory">Category</label>
      <select id="editCategory"></select>
    </div>
    <div class="form-group">
      <label for="editTitle">Title</label>
      <input type="text" id="editTitle" maxlength="200">
    </div>
    <div class="form-group">
      <label for="editAuthor">Author / Origin</label>
      <input type="text" id="editAuthor" maxlength="100">
    </div>
    <div class="form-group">
      <label for="editPrice">Price</label>
      <input type="number" id="editPrice" min="0" step="0.01">
    </div>
    <div class="form-group mini-field">
      <label for="editRecaster">Recaster</label>
      <input type="text" id="editRecaster" maxlength="100">
    </div>
    <div class="form-group mini-field">
      <label for="editCombatPoints">Combat Points</label>
      <input type="text" id="editCombatPoints" maxlength="20">
    </div>
    <div class="form-group mini-field">
      <label for="editStatus">Status</label>
      <input type="text" id="editStatus" maxlength="50">
    </div>
    <div class="form-group">
      <label>Images <span class="edit-img-hint">(click X to remove, crop icon to edit, arrows to reorder)</span>
        <span class="edit-img-counter" id="editImageCounter">0 / 10</span></label>
      <div class="edit-image-grid" id="editImageGrid"></div>
      <div class="margin-top-sm">
        <button type="button" class="btn btn-sm" id="addImagesBtn">+ Add Images</button>
        <input type="file" id="editImage" accept="image/*" multiple class="hidden">
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" id="saveEditBtn">Save</button>
      <button class="btn btn-danger" id="cancelEditBtn">Cancel</button>
    </div>
  </div>
</div>`;

const CROP_MODAL_HTML = `
<div class="modal-overlay" id="cropModal" role="dialog" aria-modal="true" aria-label="Crop image">
  <div class="modal modal-crop">
    <h2>Crop Image</h2>
    <div class="crop-container"><img id="cropImage" src="" alt=""></div>
    <div class="btn-row-end">
      <button class="btn btn-success" id="cropApplyBtn">Apply Crop</button>
      <button class="btn btn-danger" id="cropCancelBtn">Cancel</button>
    </div>
  </div>
</div>`;

const LIGHTBOX_HTML = `
<div class="lightbox-overlay" id="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
  <button class="lightbox-close" id="lbClose" aria-label="Close">&times;</button>
  <div class="lightbox-hint" id="lbHint">Swipe or tap screen edges</div>
  <div class="lightbox-edge left" id="lbEdgeLeft" aria-hidden="true"></div>
  <div class="lightbox-edge right" id="lbEdgeRight" aria-hidden="true"></div>
  <div class="lightbox-content">
    <div class="lightbox-main">
      <button class="lightbox-nav lightbox-prev" id="lbPrev" aria-label="Previous image">&#10094;</button>
      <div class="lightbox-image-wrap">
        <img id="lbImg" src="" alt="">
      </div>
      <button class="lightbox-nav lightbox-next" id="lbNext" aria-label="Next image">&#10095;</button>
    </div>
    <div class="lightbox-info">
      <div class="lightbox-title" id="lbTitle"></div>
      <div class="lightbox-author" id="lbAuthor"></div>
      <div class="lightbox-dots" id="lbDots"></div>
    </div>
  </div>
</div>`;

function inject(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  document.body.appendChild(template.content.cloneNode(true));
}

export function injectAuthModal() {
  // Idempotent: a page with its own copy of the modal is left untouched
  if (!document.getElementById('authModal')) inject(AUTH_MODAL_HTML);
}

export function injectSharedModals({ lightbox = true } = {}) {
  // Guards keep this idempotent: a page with its own copy of a modal is left untouched
  if (!document.getElementById('editModal')) inject(EDIT_MODAL_HTML);
  if (!document.getElementById('cropModal')) inject(CROP_MODAL_HTML);
  if (lightbox && !document.getElementById('lightbox')) inject(LIGHTBOX_HTML);
}
