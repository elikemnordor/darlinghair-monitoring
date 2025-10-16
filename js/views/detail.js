// Detail view with edit mode
import { state } from '../state.js';
import { createCarousel } from '../components/carousel.js';
import { createNavMapView } from '../components/map.js';
import { 
  uploadImage
} from '../services/supabase.js';

export function renderDetail(params) {
  const outletId = params[0];
  const session = state.getSession();
  const outlet = state.getOutletById(outletId, session.agentId);
  
  if (!outlet) {
    window.location.hash = '#/list';
    return;
  }
  
  const canEdit = outlet.agent_id === session.agentId;
  
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="detail-view">
      <header class="detail-header">
        <button class="btn-icon" id="back-btn">← Back</button>
        <h1>Outlet Details</h1>
        ${canEdit ? '<button class="btn-icon" id="edit-btn">Edit</button>' : '<div></div>'}
      </header>
      
      <div class="detail-carousel" id="detail-carousel">
        <div class="carousel-track">
          ${(() => {
            const carouselImages = [];
            if (outlet.outlet_front_image) carouselImages.push(outlet.outlet_front_image);
            if (outlet.outlet_side_image) carouselImages.push(outlet.outlet_side_image);
            if (carouselImages.length === 0) {
              carouselImages.push('https://via.placeholder.com/720x405/dddddd/666666?text=No+Image');
            }
            return carouselImages.map(img => `
              <div class="carousel-slide">
                <img src="${img}" alt="${outlet.outlet_name}" loading="lazy">
              </div>
            `).join('');
          })()}
        </div>
        <div class="carousel-dots">
          ${(() => {
            const carouselImages = [];
            if (outlet.outlet_front_image) carouselImages.push(outlet.outlet_front_image);
            if (outlet.outlet_side_image) carouselImages.push(outlet.outlet_side_image);
            if (carouselImages.length === 0) carouselImages.push('placeholder');
            return carouselImages.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}"></div>`).join('');
          })()}
        </div>
        <div class="carousel-actions">
          <button class="carousel-action-btn" id="nav-btn" aria-label="Navigate to outlet" title="Navigate">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </button>
          <button class="carousel-action-btn" id="map-overview-btn" aria-label="View all outlets on map" title="Map Overview">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="detail-content" id="detail-content">
        <!-- Will be rendered by renderViewMode or renderEditMode -->
      </div>
    </div>
  `;
  
  addDetailStyles();
  createCarousel('detail-carousel');
  
  // Set up navigation - return to previous route (map or list)
  document.getElementById('back-btn').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/list';
    }
  });
  
  // Render view mode initially
  renderViewMode(outlet);
  
  // Set up edit button if allowed
  if (canEdit) {
    document.getElementById('edit-btn').addEventListener('click', () => {
      renderEditMode(outlet);
    });
  }
  
  // Set up navigation button - opens nav map with user location and outlet
  document.getElementById('nav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    createNavMapView(outlet);
  });
  
  // Set up map overview button - goes to main map view
  document.getElementById('map-overview-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    state.setMapSelectedOutletId(outlet.id);
    window.location.hash = '#/map';
  });
}

function renderViewMode(outlet) {
  const content = document.getElementById('detail-content');
  const validatedText = outlet._isValidated ? 'Validated' : 'Not validated';
  const validatedClass = outlet._isValidated ? 'validated' : 'not-validated';
  
  // Collect product and telescopic images with labels (arrays only)
  const productTelescopicImages = [];
  if (Array.isArray(outlet.product_names) && Array.isArray(outlet.product_images)) {
    for (let i = 0; i < outlet.product_names.length; i++) {
      const name = outlet.product_names[i];
      const url = outlet.product_images[i];
      if (url) productTelescopicImages.push({ url, label: name });
    }
  }
  if (outlet.telescopic && outlet.telescopic_image) {
    productTelescopicImages.push({ url: outlet.telescopic_image, label: 'Telescopic' });
  }
  
  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-title">
        <h2>${outlet.outlet_name}</h2>
        <span class="badge badge-${outlet.outlet_type}">${outlet.outlet_type}</span>
      </div>
      
      <div class="status-badge badge badge-${validatedClass}">
        ${validatedText}
        ${outlet.created_at ? `<br><small>on ${new Date(outlet.created_at).toLocaleDateString()}</small>` : ''}
      </div>
    </div>
    
    ${productTelescopicImages.length > 0 ? `
      <div class="detail-section">
        <h3>Product & Telescopic Images</h3>
        <div class="detail-carousel secondary-carousel" id="products-telescopic-carousel">
          <div class="carousel-track">
            ${productTelescopicImages.map(img => `
              <div class="carousel-slide">
                <img src="${img.url}" alt="${img.label}" loading="lazy">
                <div class="carousel-image-label">
                  <span class="image-label-chip">${img.label}</span>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="carousel-dots">
            ${productTelescopicImages.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    
    <div class="detail-section">
      <h3>Location</h3>
      <p><strong>Community:</strong> ${outlet.community}</p>
      <p><strong>Assembly:</strong> ${outlet.assembly}</p>
      <p><strong>Address:</strong> ${outlet.address}</p>
      <p><strong>Coordinates:</strong> ${outlet.latitude}, ${outlet.longitude}</p>
    </div>
    
    <div class="detail-section">
      <h3>Contact</h3>
      <p><strong>Contact Name:</strong> ${outlet.contact_name}</p>
      <p><strong>Contact Phone:</strong> ${outlet.contact_phone}</p>
      <p><strong>Business Phone:</strong> ${outlet.business_phone}</p>
    </div>
    
    <div class="detail-section">
      <h3>Details</h3>
      ${outlet.outlet_type === 'salon' ? `<p><strong>Number of Stylists:</strong> ${outlet.number_of_stylists}</p>` : ''}
      <p><strong>Headerboard:</strong> ${outlet.headerboard ? 'Yes' : 'No'}</p>
      ${outlet._isValidated ? `<p><strong>Headerboard Agreement:</strong> ${outlet.headerboard_agreement ? 'Yes' : 'No'}</p>` : ''}
      <p><strong>Painted:</strong> ${outlet.painted ? 'Yes' : 'No'}</p>
      ${outlet._isValidated ? `<p><strong>Painted Agreement:</strong> ${outlet.painted_agreement ? 'Yes' : 'No'}</p>` : ''}
      <p><strong>Telescopic:</strong> ${outlet.telescopic ? 'Yes' : 'No'}</p>
      ${outlet._isValidated ? `<p><strong>Telescopic Agreement:</strong> ${outlet.telescopic_agreement ? 'Yes' : 'No'}</p>` : ''}
    </div>
    
    ${Array.isArray(outlet.product_names) && outlet.product_names.length > 0 ? `
      <div class="detail-section">
        <h3>Products</h3>
        <div class="card-attributes">
          ${outlet.product_names.map(n => `<span class="badge">${n}</span>`).join('')}
        </div>
      </div>
    ` : ''}
    
    ${outlet._isValidated && outlet.updated_at ? `
      <div class="detail-section">
        <p class="detail-meta">Last updated: ${new Date(outlet.updated_at).toLocaleString()}</p>
      </div>
    ` : ''}

    <div class="detail-section">
      <h3>Partnership</h3>
      <p><strong>Agreement Date:</strong> ${outlet.partnership_agreement_date ? new Date(outlet.partnership_agreement_date).toLocaleDateString() : '—'}</p>
      <p><strong>Expiring Date:</strong> ${outlet.partnership_expiring_date ? new Date(outlet.partnership_expiring_date).toLocaleDateString() : '—'}</p>
    </div>
  `;
  
  // Initialize product/telescopic carousel if present
  if (productTelescopicImages.length > 0) {
    setTimeout(() => {
      createCarousel('products-telescopic-carousel');
    }, 50);
  }
}

function renderEditMode(outlet) {
  const content = document.getElementById('detail-content');
  const assignedOutletId = outlet.assigned_outlet_id || outlet.assigned_outlet_id;
  const isValidated = outlet._isValidated;
  // Precompute date input values (yyyy-mm-dd) for partnership dates
  const agreementDateVal = outlet.partnership_agreement_date ? new Date(outlet.partnership_agreement_date).toISOString().slice(0,10) : '';
  const expiringDateVal = outlet.partnership_expiring_date ? new Date(outlet.partnership_expiring_date).toISOString().slice(0,10) : '';
  
  content.innerHTML = `
    <form class="edit-form" id="edit-form">
      <div class="detail-section">
        <h3>Basic Information</h3>
        
        <div class="form-group">
          <label>Outlet Name</label>
          <input type="text" name="outlet_name" value="${outlet.outlet_name}" required>
        </div>
        
        <div class="form-group">
          <label>Outlet Type</label>
          <select name="outlet_type" id="outlet-type" required>
            ${!isValidated ? '<option value="" selected disabled>Select Outlet Type</option>' : ''}
            <option value="retail" ${isValidated && outlet.outlet_type === 'retail' ? 'selected' : ''}>Retail</option>
            <option value="salon" ${isValidated && outlet.outlet_type === 'salon' ? 'selected' : ''}>Salon</option>
          </select>
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Outlet Images <span class="required-note">(required for validation)</span></h3>
        
        <div class="form-group image-capture-group">
          <label>Front Image</label>
          ${outlet.outlet_front_image ? `
            <div class="image-preview">
              <img src="${outlet.outlet_front_image}" alt="Front">
              <button type="button" class="btn-remove-image" data-field="outlet_front_image">✕ Remove</button>
            </div>
          ` : ''}
          <div class="image-input-wrapper">
            <button type="button" class="btn-camera" data-target="outlet-front-image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Take Photo
            </button>
            <button type="button" class="btn-upload" data-target="outlet-front-image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload
            </button>
          </div>
          <input type="file" name="outlet_front_image" accept="image/*" capture="environment" id="outlet-front-image" style="display:none;">
        </div>
        
        <div class="form-group image-capture-group">
          <label>Side Image</label>
          ${outlet.outlet_side_image ? `
            <div class="image-preview">
              <img src="${outlet.outlet_side_image}" alt="Side">
              <button type="button" class="btn-remove-image" data-field="outlet_side_image">✕ Remove</button>
            </div>
          ` : ''}
          <div class="image-input-wrapper">
            <button type="button" class="btn-camera" data-target="outlet-side-image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Take Photo
            </button>
            <button type="button" class="btn-upload" data-target="outlet-side-image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload
            </button>
          </div>
          <input type="file" name="outlet_side_image" accept="image/*" capture="environment" id="outlet-side-image" style="display:none;">
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Location</h3>
        
        <div class="form-group">
          <label>Community</label>
          <input type="text" name="community" value="${outlet.community}" required readonly>
        </div>
        
        <div class="form-group">
          <label>Assembly</label>
          <input type="text" name="assembly" value="${outlet.assembly}" required readonly>
        </div>
        
        <div class="form-group">
          <label>Address</label>
          <input type="text" name="address" value="${outlet.address}" required>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Latitude <span class="immutable-note">(immutable)</span></label>
            <input type="number" step="any" name="latitude" value="${outlet.latitude}" readonly>
          </div>
          
          <div class="form-group">
            <label>Longitude <span class="immutable-note">(immutable)</span></label>
            <input type="number" step="any" name="longitude" value="${outlet.longitude}" readonly>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Contact</h3>
        
        <div class="form-group">
          <label>Contact Name</label>
          <input type="text" name="contact_name" value="${outlet.contact_name}" required>
        </div>
        
        <div class="form-group">
          <label>Contact Phone</label>
          <input type="text" name="contact_phone" value="${outlet.contact_phone}" required>
        </div>
        
        <div class="form-group">
          <label>Business Phone</label>
          <input type="text" name="business_phone" value="${outlet.business_phone}" required>
        </div>
      </div>
      
      <div class="detail-section" id="salon-section" ${(!isValidated || outlet.outlet_type === 'retail') ? 'style="display:none"' : ''}>
        <h3>Salon Details</h3>
        
        <div class="form-group">
          <label>Number of Stylists</label>
          <input type="number" name="number_of_stylists" value="${outlet.number_of_stylists}" min="0" id="stylists-input">
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Attributes</h3>
        
        <div class="checkbox-group two-up">
          <label>
            <input type="checkbox" name="headerboard" id="headerboard" ${outlet.headerboard ? 'checked' : ''}>
            Headerboard
          </label>
          <label class="sub">
            <input type="checkbox" name="headerboard_agreement" id="headerboard-agreement" ${outlet.headerboard ? 'checked' : ''}>
            Agreement
          </label>
        </div>
        
        <div class="checkbox-group two-up">
          <label>
            <input type="checkbox" name="painted" id="painted" ${outlet.painted ? 'checked' : ''}>
            Painted
          </label>
          <label class="sub">
            <input type="checkbox" name="painted_agreement" id="painted-agreement" ${outlet.painted ? 'checked' : ''}>
            Agreement
          </label>
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Products</h3>
        
        <div class="checkbox-group">
          <label>
            <input type="checkbox" name="product_displayed" id="product-displayed" ${outlet.product_displayed ? 'checked' : ''}>
            Product(s) Displayed
          </label>
        </div>
        
        <div id="products-section" ${!outlet.product_displayed ? 'style="display:none"' : ''}>
          <div id="products-options" class="checkbox-group"></div>
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Telescopic</h3>
        
        <div class="checkbox-group two-up">
          <label>
            <input type="checkbox" name="telescopic" id="telescopic" ${outlet.telescopic ? 'checked' : ''}>
            Telescopic Present
          </label>
          <label class="sub">
            <input type="checkbox" name="telescopic_agreement" id="telescopic-agreement" ${outlet.telescopic ? 'checked' : ''}>
            Agreement
          </label>
        </div>
        
        <div id="telescopic-image-group" class="form-group image-capture-group" ${!outlet.telescopic ? 'style="display:none"' : ''}>
          <label>Telescopic Image</label>
          ${outlet.telescopic_image ? `
            <div class="image-preview">
              <img src="${outlet.telescopic_image}" alt="Telescopic">
              <button type="button" class="btn-remove-image" data-field="telescopic_image">✕ Remove</button>
            </div>
          ` : ''}
          <div class="image-input-wrapper">
            <button type="button" class="btn-camera" data-target="telescopic-image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              Take Photo
            </button>
            <button type="button" class="btn-upload" data-target="telescopic-image">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Upload
            </button>
          </div>
          <input type="file" name="telescopic_image" accept="image/*" capture="environment" id="telescopic-image" style="display:none;">
        </div>
      </div>
      
      <div class="detail-section">
        <h3>Validation</h3>
        
        <div class="checkbox-group">
          <label>
            <input type="checkbox" name="validated" id="validated-checkbox" ${isValidated ? 'checked' : ''}>
            Mark as validated
          </label>
        </div>
        ${isValidated ? '<p class="help-text">Unchecking will remove this outlet from your validated list</p>' : '<p class="help-text">Front and side images are required for validation</p>'}
      </div>
      
      <div class="detail-section">
        <h3>Partnership</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Agreement Date</label>
            <input type="date" name="partnership_agreement_date" value="${agreementDateVal}">
          </div>
          <div class="form-group">
            <label>Expiring Date</label>
            <input type="date" name="partnership_expiring_date" value="${expiringDateVal}">
          </div>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `;
  
  // Handle outlet type change
  const outletTypeSelect = document.getElementById('outlet-type');
  const salonSection = document.getElementById('salon-section');
  const stylistsInput = document.getElementById('stylists-input');
  
  outletTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'salon') {
      salonSection.style.display = 'block';
      if (!isValidated) {
        try { stylistsInput.value = '0'; } catch(_) {}
      }
    } else {
      salonSection.style.display = 'none';
      try { stylistsInput.value = '0'; } catch(_) {}
    }
  });
  
  // Handle product displayed toggle
  const productDisplayedCb = document.getElementById('product-displayed');
  const productsSection = document.getElementById('products-section');
  
  productDisplayedCb.addEventListener('change', (e) => {
    productsSection.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // Populate products dynamically (uses cached getter)
  (async () => {
    try {
      const optionsEl = document.getElementById('products-options');
      if (!optionsEl) return;
      const products = await state.getProductsCached(300000);
      const initialSelected = Array.isArray(outlet.product_names) ? outlet.product_names : [];
      const nameToExistingUrl = {};
      if (Array.isArray(outlet.product_names) && Array.isArray(outlet.product_images)) {
        for (let i = 0; i < outlet.product_names.length; i++) {
          nameToExistingUrl[outlet.product_names[i]] = outlet.product_images[i] || null;
        }
      }

      const rows = products.map(p => {
        const selected = initialSelected.includes(p.name);
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const existingUrl = nameToExistingUrl[p.name];
        return `
          <div class="product-row" data-product="${p.name}">
            <label style="display:flex;align-items:center;gap:8px;margin:6px 0;">
              <input type="checkbox" class="product-option-checkbox" value="${p.name}" data-product="${p.name}" ${selected ? 'checked' : ''}>
              <span>${p.name}</span>
            </label>
            <div class="form-group image-capture-group product-image-group" data-product="${p.name}" style="display:${selected ? 'block' : 'none'}">
              ${existingUrl ? `
                <div class="image-preview">
                  <img src="${existingUrl}" alt="${p.name}">
                  <button type="button" class="btn-remove-image" data-product-name="${p.name}">✕ Remove</button>
                </div>
              ` : ''}
              <div class="image-input-wrapper">
                <button type="button" class="btn-camera" data-target="product-image-${slug}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Take Photo
                </button>
                <button type="button" class="btn-upload" data-target="product-image-${slug}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Upload
                </button>
              </div>
              <input type="file" accept="image/*" capture="environment" id="product-image-${slug}" style="display:none;">
            </div>
          </div>
        `;
      }).join('');
      optionsEl.innerHTML = products.length === 0
        ? '<p class="help-text">No products available.</p>'
        : rows;

      // Toggle image groups per product checkbox
      optionsEl.querySelectorAll('.product-option-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const name = cb.dataset.product;
          const group = optionsEl.querySelector(`.product-image-group[data-product="${CSS.escape(name)}"]`);
          if (group) group.style.display = e.target.checked ? 'block' : 'none';
        });
      });

      // Attach remove handlers for existing previews
      optionsEl.querySelectorAll('.product-image-group .btn-remove-image').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const name = btn.getAttribute('data-product-name');
          const group = btn.closest('.product-image-group');
          const preview = btn.closest('.image-preview');
          if (preview) preview.remove();
          if (group) group.dataset.removeProductImage = name;
          // Also clear associated file input if any
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const input = document.getElementById(`product-image-${slug}`);
          if (input) input.value = '';
        });
      });
    } catch (err) {
      console.warn('Failed to load products:', err);
    }
  })();

  
  // Handle telescopic toggle
  const telescopicCb = document.getElementById('telescopic');
  const telescopicImageGroup = document.getElementById('telescopic-image-group');
  
  telescopicCb.addEventListener('change', (e) => {
    telescopicImageGroup.style.display = e.target.checked ? 'block' : 'none';
  });
  
  // Input restrictions
  try {
    const contactNameInput = editFormEl.querySelector('input[name="contact_name"]');
    if (contactNameInput) {
      contactNameInput.addEventListener('input', () => {
        contactNameInput.value = contactNameInput.value.replace(/[^A-Za-z\s]/g, '');
      });
    }
    ['contact_phone', 'business_phone'].forEach((n) => {
      const inp = editFormEl.querySelector(`input[name="${n}"]`);
      if (inp) {
        inp.addEventListener('input', () => {
          inp.value = inp.value.replace(/\D/g, '');
        });
      }
    });
  } catch(_) {}
  
  // Handle image removal
  document.querySelectorAll('.btn-remove-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const field = btn.dataset.field;
      const preview = btn.closest('.image-preview');
      if (preview) {
        preview.remove();
      }
      // Mark field for removal in save
      const formGroup = btn.closest('.form-group');
      if (formGroup) {
        formGroup.dataset.removeImage = field;
      }
    });
  });
  
  // Delegated handlers so dynamically added controls work
  const editFormEl = document.getElementById('edit-form');
  
  // One-way auto-check: when presence is checked, default its agreement to checked
  try {
    const hb = editFormEl.querySelector('#headerboard');
    const hbAgree = editFormEl.querySelector('#headerboard-agreement');
    if (hb && hbAgree) {
      hb.addEventListener('change', (e) => {
        if (e.target.checked && !hbAgree.checked) hbAgree.checked = true;
      });
    }
    const painted = editFormEl.querySelector('#painted');
    const paintedAgree = editFormEl.querySelector('#painted-agreement');
    if (painted && paintedAgree) {
      painted.addEventListener('change', (e) => {
        if (e.target.checked && !paintedAgree.checked) paintedAgree.checked = true;
      });
    }
    const tel = editFormEl.querySelector('#telescopic');
    const telAgree = editFormEl.querySelector('#telescopic-agreement');
    if (tel && telAgree) {
      tel.addEventListener('change', (e) => {
        if (e.target.checked && !telAgree.checked) telAgree.checked = true;
      });
    }
  } catch (_) {}
  
  // Handle camera and upload button clicks (delegated)
  editFormEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-camera, .btn-upload');
    if (!btn) return;
    e.preventDefault();
    const targetId = btn.dataset.target;
    const fileInput = document.getElementById(targetId);
    if (fileInput) {
      if (btn.classList.contains('btn-upload')) {
        fileInput.removeAttribute('capture');
      } else {
        fileInput.setAttribute('capture', 'environment');
      }
      fileInput.click();
    }
  });
  
  // Handle live image previews on file selection (delegated)
  editFormEl.addEventListener('change', (evt) => {
    const input = evt.target;
    if (!(input && input.matches('input[type="file"]'))) return;
    const file = input.files && input.files[0];
    const formGroup = input.closest('.form-group');
    if (!file || !formGroup) return;

    // Validate file type and size (<= 30MB, image only)
    const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image too large. Maximum allowed size is 30MB.');
      input.value = '';
      return;
    }

    // Remove any existing preview and clear prior remove markers
    const existingPreview = formGroup.querySelector('.image-preview');
    if (existingPreview) existingPreview.remove();
    formGroup.removeAttribute('data-remove-image');
    if (formGroup.classList.contains('product-image-group')) {
      delete formGroup.dataset.removeProductImage;
    }

    // Create preview element
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = `
      <img src="${objectUrl}" alt="Preview">
      <button type="button" class="btn-remove-image">✕ Remove</button>
    `;

    // Insert before the input controls wrapper
    const inputWrapper = formGroup.querySelector('.image-input-wrapper');
    if (inputWrapper) {
      formGroup.insertBefore(preview, inputWrapper);
    } else {
      formGroup.appendChild(preview);
    }

    // Attach remove handler to reset the input and mark removal
    const removeBtn = preview.querySelector('.btn-remove-image');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      input.value = '';
      try { URL.revokeObjectURL(objectUrl); } catch (_) {}
      preview.remove();
      // Mark field as removed so save flow deletes existing storage image if any
      if (formGroup.classList.contains('product-image-group')) {
        const productName = formGroup.getAttribute('data-product');
        if (productName) formGroup.dataset.removeProductImage = productName;
      } else if (input.name) {
        formGroup.dataset.removeImage = input.name;
      }
    });
  });
  
  // Handle cancel
  document.getElementById('cancel-btn').addEventListener('click', () => {
    const session = state.getSession();
    const freshOutlet = state.getOutletById(outlet.captured_id || outlet.assigned_outlet_id, session.agentId);
    renderViewMode(freshOutlet);
  });
  
  // Handle form submit
  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveOutlet(outlet);
  });
}

async function saveOutlet(originalOutlet) {
  const form = document.getElementById('edit-form');
  const formData = new FormData(form);
  const session = state.getSession();
  
  const willValidate = formData.get('validated') === 'on';
  const wasValidated = originalOutlet._isValidated;
  const assignedOutletId = originalOutlet.assigned_outlet_id || originalOutlet.assigned_outlet_id;
  
  // UI: show saving state
  const saveBtn = form.querySelector('button[type="submit"]');
  const cancelBtn = document.getElementById('cancel-btn');
  const originalSaveHTML = saveBtn ? saveBtn.innerHTML : '';
  const setSaving = (on) => {
    try {
      form.querySelectorAll('input, select, button').forEach(el => { el.disabled = on; });
      if (saveBtn) {
        if (on) {
          saveBtn.innerHTML = '<span class="inline-spinner" role="status" aria-label="Saving"></span>';
        } else {
          saveBtn.innerHTML = originalSaveHTML || 'Save Changes';
        }
      }
    } catch (_) {}
  };
  setSaving(true);
  console.log('🔍 [detail.js] Starting save for outlet:', originalOutlet);
  
  // Handle un-validation (delete captured record)
  if (wasValidated && !willValidate) {
    if (confirm('Are you sure you want to un-validate this outlet? This will remove it from your validated list.')) {
      await state.deleteCapturedOutlet(originalOutlet.captured_id);
      window.location.hash = '#/list';
      return;
    } else {
      setSaving(false);
      return;
    }
  }
  
  // If not validating, do not perform any uploads/deletes or DB writes
  if (!willValidate) {
    alert('Please mark as validated to save changes.');
    setSaving(false);
    return;
  }
  
  const __pv_outletName = (formData.get('outlet_name') || '').trim();
  const __pv_contactName = (formData.get('contact_name') || '').trim();
  const __pv_contactPhone = (formData.get('contact_phone') || '').trim();
  const __pv_businessPhone = (formData.get('business_phone') || '').trim();
  const __pv_agreementDateStr = formData.get('partnership_agreement_date') || '';
  const __pv_expiringDateStr = formData.get('partnership_expiring_date') || '';
  const __pv_telescopicChecked = formData.get('telescopic') === 'on';
  const __pv_selectedType = (formData.get('outlet_type') || '').trim();
  const __pv_stylists = parseInt(formData.get('number_of_stylists')) || 0;

  if (willValidate) {
    if (!__pv_outletName || __pv_outletName.toLowerCase() === 'tbd') {
      alert('Outlet Name is required and cannot be "TBD".');
      setSaving(false);
      return;
    }
    if (!__pv_contactName || __pv_contactName.toLowerCase() === 'null') {
      alert('Contact name is required and cannot be null or empty.');
      setSaving(false);
      return;
    }
    const __pv_lettersOnly = /^[A-Za-z\s]+$/;
    if (!__pv_lettersOnly.test(__pv_contactName)) {
      alert('Contact name must contain letters only.');
      setSaving(false);
      return;
    }
    const __pv_digits10 = /^\d{1,10}$/;
    if (!__pv_contactPhone || __pv_contactPhone.toLowerCase() === 'null' || !__pv_digits10.test(__pv_contactPhone)) {
      alert('Contact phone must be 1-10 digits (numbers only) and cannot be null or empty.');
      setSaving(false);
      return;
    }
    if (!__pv_businessPhone || __pv_businessPhone.toLowerCase() === 'null' || !__pv_digits10.test(__pv_businessPhone)) {
      alert('Business phone must be 1-10 digits (numbers only) and cannot be null or empty.');
      setSaving(false);
      return;
    }
    if (!__pv_agreementDateStr || !__pv_expiringDateStr) {
      alert('Partnership agreement and expiry dates are required.');
      setSaving(false);
      return;
    }
    const __pv_agreementDate = new Date(__pv_agreementDateStr);
    const __pv_expiringDate = new Date(__pv_expiringDateStr);
    if (__pv_expiringDate < __pv_agreementDate) {
      alert('Partnership expiry date cannot be before the agreement date.');
      setSaving(false);
      return;
    }
    // First-time validation must have an explicitly selected outlet type
    if (!wasValidated && !__pv_selectedType) {
      alert('Please select an outlet type.');
      setSaving(false);
      return;
    }
    // Salon must have stylists > 0
    if (__pv_selectedType === 'salon' && __pv_stylists === 0) {
      alert('Number of Stylists must be greater than zero for Salon outlets.');
      setSaving(false);
      return;
    }
  }

  if (willValidate && !wasValidated) {
    const __pv_removedFront = !!document.querySelector('[data-remove-image="outlet_front_image"]');
    const __pv_removedSide = !!document.querySelector('[data-remove-image="outlet_side_image"]');
    const __pv_removedTel = !!document.querySelector('[data-remove-image="telescopic_image"]');
    const __pv_hasNewFront = (() => { const f = formData.get('outlet_front_image'); return f && f.size > 0; })();
    const __pv_hasNewSide = (() => { const f = formData.get('outlet_side_image'); return f && f.size > 0; })();
    const __pv_hasNewTel = (() => { const f = formData.get('telescopic_image'); return f && f.size > 0; })();
    const __pv_frontOk = __pv_hasNewFront || (!__pv_removedFront && !!originalOutlet.outlet_front_image);
    const __pv_sideOk = __pv_hasNewSide || (!__pv_removedSide && !!originalOutlet.outlet_side_image);
    if (!__pv_frontOk || !__pv_sideOk) {
      alert('Front and side images are required for validation.');
      setSaving(false);
      return;
    }
    if (__pv_telescopicChecked) {
      const __pv_telOk = __pv_hasNewTel || (!__pv_removedTel && !!originalOutlet.telescopic_image);
      if (!__pv_telOk) {
        alert('Telescopic image is required when telescopic is present.');
        setSaving(false);
        return;
      }
    }
  }

  // Process image uploads
  const imageFields = ['outlet_front_image', 'outlet_side_image', 'telescopic_image'];
  const imageData = {};
  const capturedId = originalOutlet.captured_id || `cap_${assignedOutletId}_${session.agentId}`;
  
  for (const field of imageFields) {
    const file = formData.get(field);
    const removeMarker = document.querySelector(`[data-remove-image="${field}"]`);
    const existingUrl = originalOutlet[field];
    
    if (removeMarker) {
      // Image was removed - delete from storage if it's a storage URL
      imageData[field] = null;
    } else if (file && file.size > 0) {
      // New image uploaded
      // Validate again on save (defense-in-depth)
      const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
      if (!file.type || !file.type.startsWith('image/')) {
        alert(`The selected file for ${field.replace(/_/g, ' ')} must be an image.`);
        setSaving(false);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        alert(`The selected image for ${field.replace(/_/g, ' ')} exceeds 30MB.`);
        setSaving(false);
        return;
      }
      try {
        // Upload to Storage
        const filename = field.replace(/_image$/, ''); // outlet_front_image -> outlet_front
        const result = await uploadImage(file, session.userId, `${filename}_${capturedId}`);
        
        if (result.error) {
          throw new Error(result.error.message);
        }
        
        imageData[field] = result.url;
        console.log(`✅ Uploaded ${field} to Storage:`, result.url);
      } catch (err) {
        console.error(`Storage upload failed for ${field}:`, err);
        alert(`Failed to upload ${field.replace(/_/g, ' ')}. Please try again.`);
        setSaving(false);
        return;
      }
    } else {
      // Keep existing image (could be data URL or storage URL)
      imageData[field] = existingUrl || null;
    }
  }
  
  // Build update object
  // Build selected product names from dynamic options
  const selectedProductNames = Array.from(document.querySelectorAll('.product-option-checkbox:checked')).map(cb => cb.value);
  
  // Build product_images aligned with product_names
  const productImages = [];
  for (const name of selectedProductNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const input = document.getElementById(`product-image-${slug}`);
    const file = input && input.files && input.files[0] ? input.files[0] : null;
    // find existing url for this name
    let existingUrl = null;
    if (Array.isArray(originalOutlet.product_names) && Array.isArray(originalOutlet.product_images)) {
      const idx = originalOutlet.product_names.indexOf(name);
      if (idx >= 0) existingUrl = originalOutlet.product_images[idx] || null;
    } else {
      if (name === 'Product A') existingUrl = originalOutlet.product_a_image || null;
      if (name === 'Product B') existingUrl = originalOutlet.product_b_image || null;
      if (name === 'Product C') existingUrl = originalOutlet.product_c_image || null;
    }
    // if removed explicitly
    const group = document.querySelector(`.product-image-group[data-product="${CSS.escape(name)}"]`);
    const removed = group && group.dataset.removeProductImage === name;
    
    if (removed) {
      // delete from storage if needed
      productImages.push(null);
    } else if (file) {
      // validate size/type (reuse earlier constraints)
      const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
      if (!file.type || !file.type.startsWith('image/')) {
        alert(`The selected file for ${name} must be an image.`);
        setSaving(false);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        alert(`The selected image for ${name} exceeds 30MB.`);
        setSaving(false);
        return;
      }
      try {
        const result = await uploadImage(file, session.userId, `product_${slug}_${capturedId}`);
        if (result.error) throw new Error(result.error.message);
        productImages.push(result.url);
      } catch (err) {
        console.error(`Failed to upload product image for ${name}:`, err);
        alert(`Failed to upload image for ${name}. Please try again.`);
        setSaving(false);
        return;
      }
    } else {
      // keep existing
      productImages.push(existingUrl || null);
    }
  }
  
  const outletName = (formData.get('outlet_name') || '').trim();
  const contactName = (formData.get('contact_name') || '').trim();
  const contactPhone = (formData.get('contact_phone') || '').trim();
  const businessPhone = (formData.get('business_phone') || '').trim();
  const agreementDateStr = formData.get('partnership_agreement_date') || '';
  const expiringDateStr = formData.get('partnership_expiring_date') || '';
  
  const updates = {
    assigned_outlet_id: assignedOutletId,
    agent_id: session.agentId,
    outlet_name: outletName,
    outlet_type: formData.get('outlet_type'),
    community: formData.get('community'),
    assembly: formData.get('assembly'),
    address: formData.get('address'),
    latitude: originalOutlet.latitude, // immutable
    longitude: originalOutlet.longitude, // immutable
    contact_name: contactName,
    contact_phone: contactPhone,
    business_phone: businessPhone,
    number_of_stylists: parseInt(formData.get('number_of_stylists')) || 0,
    headerboard: formData.get('headerboard') === 'on',
    headerboard_agreement: formData.get('headerboard_agreement') === 'on',
    painted: formData.get('painted') === 'on',
    painted_agreement: formData.get('painted_agreement') === 'on',
    telescopic: formData.get('telescopic') === 'on',
    telescopic_agreement: formData.get('telescopic_agreement') === 'on',
    outlet_front_image: imageData.outlet_front_image,
    outlet_side_image: imageData.outlet_side_image,
    product_names: selectedProductNames,
    product_images: productImages,
    telescopic_image: imageData.telescopic_image,
    partnership_agreement_date: agreementDateStr || null,
    partnership_expiring_date: expiringDateStr || null,
  };
  
  if (willValidate) {
    if (!outletName || outletName.toLowerCase() === 'tbd') {
      alert('Outlet Name is required and cannot be "TBD".');
      setSaving(false);
      return;
    }
    if (!contactName || contactName.toLowerCase() === 'null') {
      alert('Contact name is required and cannot be null or empty.');
      setSaving(false);
      return;
    }
    const lettersOnly = /^[A-Za-z\s]+$/;
    if (!lettersOnly.test(contactName)) {
      alert('Contact name must contain letters only.');
      setSaving(false);
      return;
    }
    const digits10 = /^\d{1,10}$/;
    if (!contactPhone || contactPhone.toLowerCase() === 'null' || !digits10.test(contactPhone)) {
      alert('Contact phone must be 1-10 digits (numbers only) and cannot be null or empty.');
      setSaving(false);
      return;
    }
    if (!businessPhone || businessPhone.toLowerCase() === 'null' || !digits10.test(businessPhone)) {
      alert('Business phone must be 1-10 digits (numbers only) and cannot be null or empty.');
      setSaving(false);
      return;
    }
    if (!agreementDateStr || !expiringDateStr) {
      alert('Partnership agreement and expiry dates are required.');
      setSaving(false);
      return;
    }
    const agreementDate = new Date(agreementDateStr);
    const expiringDate = new Date(expiringDateStr);
    if (expiringDate < agreementDate) {
      alert('Partnership expiry date cannot be before the agreement date.');
      setSaving(false);
      return;
    }
    if (formData.get('outlet_type') === 'salon' && (parseInt(formData.get('number_of_stylists')) || 0) === 0) {
      alert('Number of Stylists must be greater than zero for Salon outlets.');
      setSaving(false);
      return;
    }
  }
  
  // Validation checks for first-time validation
  if (willValidate && !wasValidated) {
    
    // Required: front and side images
    if (!updates.outlet_front_image || !updates.outlet_side_image) {
      alert('Front and side images are required for validation.');
      setSaving(false);
      return;
    }
    
    // No per-product image requirement in minimal model
    
    // Required: telescopic image when telescopic is true
    if (updates.telescopic && !updates.telescopic_image) {
      alert('Telescopic image is required when telescopic is present.');
      setSaving(false);
      return;
    }
    
    // Create captured outlet
    const capturedRecord = await state.createCapturedOutlet(updates);
    alert('Outlet validated successfully!');
    
    // Redirect to detail page of newly captured outlet
    window.location.hash = `#/detail/${capturedRecord.captured_id}`;
  } else if (willValidate && wasValidated) {
    // Update existing captured outlet
    await state.updateCapturedOutlet(originalOutlet.captured_id, updates);
    
    // Fully re-render detail view so header carousel and sections update immediately
    const updatedId = originalOutlet.captured_id;
    renderDetail([updatedId]);
    alert('Changes saved successfully!');
    // If still on this form (unlikely after re-render), clear saving state
    if (document.getElementById('edit-form')) setSaving(false);
  } else {
    // Not validating, just save to captured if it exists (shouldn't happen with current UI)
    alert('Please mark as validated to save changes.');
    setSaving(false);
  }
}

function addDetailStyles() {
  if (document.getElementById('detail-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'detail-styles';
  style.textContent = `
    .detail-view {
      min-height: 100vh;
      background-color: white;
      overflow-x: hidden; /* prevent subtle horizontal scrollbar on mobile */
      padding-top: 64px; /* offset for fixed header */
    }
    
    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background-color: white;
      z-index: 1000;
    }
    
    .detail-header h1 {
      font-size: 18px;
      font-weight: 600;
    }
    
    .detail-carousel {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden; /* keep track within frame */
      overscroll-behavior-x: contain; /* avoid parent/page sideways scroll during swipe */
      contain: content; /* prevent layout spillover */
    }
    
    .carousel-actions {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .carousel-action-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.95);
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
      color: var(--primary-color);
    }
    
    .carousel-action-btn:hover {
      background-color: white;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    
    .carousel-action-btn:active {
      transform: scale(0.95);
    }
    
    .detail-content {
      padding: 16px;
    }
    
    .detail-section {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .detail-section:last-child {
      border-bottom: none;
    }
    
    .detail-section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    .detail-section p {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    
    .detail-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    
    .detail-title h2 {
      font-size: 24px;
      font-weight: 700;
    }
    
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
    }
    
    .detail-meta {
      font-size: 14px;
      color: var(--secondary-color);
    }
    
    .edit-form {
      width: 100%;
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    .form-group label {
      display: block;
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }
    
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    
    .checkbox-group {
      margin-bottom: 12px;
    }
    
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: normal;
      cursor: pointer;
    }
    
    .checkbox-group.two-up {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .checkbox-group.two-up label {
      margin: 0;
    }

    .checkbox-group label.sub {
      color: var(--secondary-color);
      font-weight: 500;
    }
    
    .checkbox-group input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }
    
    .form-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 24px;
    }
    
    .image-capture-group {
      margin-top: 12px;
    }
    
    .image-preview {
      position: relative;
      margin-bottom: 12px;
      border-radius: 8px;
      overflow: hidden;
      background-color: #f7f7f7;
    }
    
    .image-preview img {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
      display: block;
    }
    
    .btn-remove-image {
      position: absolute;
      top: 8px;
      right: 8px;
      background-color: rgba(255, 255, 255, 0.95);
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent-color);
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    
    .required-note {
      font-size: 12px;
      font-weight: normal;
      color: var(--accent-color);
    }
    
    .immutable-note {
      font-size: 12px;
      font-weight: normal;
      color: var(--secondary-color);
    }
    
    .help-text {
      font-size: 13px;
      color: var(--secondary-color);
      margin-top: 4px;
    }
    
    input[type="file"] {
      border: 1px dashed var(--border-color);
      padding: 12px;
      cursor: pointer;
    }
    
    input[readonly] {
      background-color: #f7f7f7;
      cursor: not-allowed;
    }
    
    .image-input-wrapper {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    
    .btn-camera,
    .btn-upload {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border: 2px solid var(--primary-color);
      border-radius: 8px;
      background-color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn-camera {
      color: white;
      background-color: var(--primary-color);
    }
    
    .btn-camera:active {
      transform: scale(0.98);
      background-color: #0056b3;
    }
    
    .btn-upload {
      color: var(--primary-color);
      background-color: white;
    }
    
    .btn-upload:active {
      transform: scale(0.98);
      background-color: #f0f8ff;
    }
    
    .btn-camera svg,
    .btn-upload svg {
      flex-shrink: 0;
    }
    
    .secondary-carousel {
      margin-top: 16px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .carousel-image-label {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
    }
    
    .image-label-chip {
      display: inline-block;
      background-color: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.3px;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    
    .carousel-slide {
      position: relative;
    }

    .inline-spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: inline-spin 0.8s linear infinite;
      vertical-align: middle;
    }

    @keyframes inline-spin {
      to { transform: rotate(360deg); }
    }
  `;
  
  document.head.appendChild(style);
}
