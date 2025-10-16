// List view with filters and outlet cards
import { state } from '../state.js';
import { createCarousel } from '../components/carousel.js';
import { createMapView } from '../components/map.js';
import { 
  signOut as supabaseSignOut,
  getAssignedOutlets as fetchAssignedOutletsFromSupabase,
  getCapturedOutlets as fetchCapturedOutletsFromSupabase
} from '../services/supabase.js';

let currentFilteredOutlets = [];
let activeValidationFilter = null; // null, 'validated', or 'not-validated'

export function renderList() {
  const app = document.getElementById('app');
  const session = state.getSession();
  
  // Restore validation filter from state
  activeValidationFilter = state.getValidationFilter();
  
  app.innerHTML = `
    <div class="list-view">
      <header class="list-header">
        <div class="header-top">
          <h1>Assigned Outlets</h1>
          <button class="btn-icon" id="signout-btn">Sign Out</button>
        </div>
        <p class="header-subtitle">Signed in as ${session.agentName}</p>
      </header>
      
      <div class="filters-section">
        <div class="search-box">
          <input type="text" id="search-input" placeholder="Search outlets...">
        </div>
        
        <div class="filters-row">
          <select id="community-filter">
            <option value="">All Communities</option>
          </select>
          
          <select id="assembly-filter">
            <option value="">All Assemblies</option>
          </select>
          
          <select id="outlet-type-filter">
            <option value="">All Types</option>
            <option value="retail">Retail</option>
            <option value="salon">Salon</option>
          </select>
        </div>
        
        <div class="validation-filter-chips">
          <button class="validation-chip" id="validated-chip" data-filter="validated">
            <span class="chip-label">Validated</span>
            <span class="chip-count" id="validated-count">0</span>
          </button>
          <button class="validation-chip" id="not-validated-chip" data-filter="not-validated">
            <span class="chip-label">Not validated</span>
            <span class="chip-count" id="not-validated-count">0</span>
          </button>
        </div>
      </div>
      
      <div class="outlets-list" id="outlets-list">
        <div class="loading">Loading outlets...</div>
      </div>
    </div>
    
    <button class="map-fab" id="map-fab">
      <svg class="map-fab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
      </svg>
      Map
    </button>
  `;
  
  // Add styles
  addListStyles();
  
  // Load outlets
  loadOutlets();
  
  // Restore chip active state after DOM is ready
  setTimeout(() => {
    if (activeValidationFilter) {
      const chipId = activeValidationFilter === 'validated' ? 'validated-chip' : 'not-validated-chip';
      document.getElementById(chipId)?.classList.add('active');
    }
  }, 0);
  
  // Set up event listeners
  document.getElementById('signout-btn').addEventListener('click', signOut);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('community-filter').addEventListener('change', applyFilters);
  document.getElementById('assembly-filter').addEventListener('change', applyFilters);
  document.getElementById('outlet-type-filter').addEventListener('change', applyFilters);
  document.getElementById('validated-chip').addEventListener('click', () => toggleValidationFilter('validated'));
  document.getElementById('not-validated-chip').addEventListener('click', () => toggleValidationFilter('not-validated'));
  document.getElementById('map-fab').addEventListener('click', openMapView);
}

async function loadOutlets() {
  try {
    // Use cache if fresh to avoid re-fetching on every route change
    if (!state.shouldRefetchOutlets(60000)) {
      const assignedCached = state.getAssignedOutlets();
      const listEl = document.getElementById('outlets-list');
      if (listEl) listEl.innerHTML = '';
      populateFilters(assignedCached);
      restoreSavedFiltersIntoUI();
      applyFilters();
      return;
    }

    // Otherwise fetch fresh data
    const [assigned, captured] = await Promise.all([
      fetchAssignedOutletsFromSupabase(),
      fetchCapturedOutletsFromSupabase()
    ]);

    if (!assigned || assigned.length === 0) {
      throw new Error('No data returned');
    }

    // Update state and mark fetch time
    state.setAssignedOutlets(assigned);
    state.setCapturedOutlets(captured || []);
    state.markOutletsFetched();

    // Populate filter dropdowns and restore saved filters
    populateFilters(assigned);
    restoreSavedFiltersIntoUI();

    // Render outlets with restored filters
    applyFilters();
  } catch (err) {
    console.error('Failed to load outlets:', err);
    const listEl = document.getElementById('outlets-list');
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state">
          Unable to load outlets. Please check your connection and try again.
          <div style="margin-top:12px;">
            <button class="btn-primary" id="retry-load">Retry</button>
          </div>
        </div>
      `;
      const retry = document.getElementById('retry-load');
      if (retry) retry.addEventListener('click', () => {
        // Force a refetch on manual retry
        state.forceRefetchOutlets();
        loadOutlets();
      });
    }
  }
}

function restoreSavedFiltersIntoUI() {
  const saved = state.getFilters();
  const searchEl = document.getElementById('search-input');
  const communityEl = document.getElementById('community-filter');
  const assemblyEl = document.getElementById('assembly-filter');
  const typeEl = document.getElementById('outlet-type-filter');

  if (searchEl) searchEl.value = saved.search || '';
  if (communityEl && [...communityEl.options].some(o => o.value === saved.community)) {
    communityEl.value = saved.community;
  }
  if (assemblyEl && [...assemblyEl.options].some(o => o.value === saved.assembly)) {
    assemblyEl.value = saved.assembly;
  }
  if (typeEl && [...typeEl.options].some(o => o.value === saved.outlet_type)) {
    typeEl.value = saved.outlet_type;
  }
}

function populateFilters(outlets) {
  const communities = [...new Set(outlets.map(s => s.community))].sort();
  const assemblies = [...new Set(outlets.map(s => s.assembly))].sort();
  
  const communityFilter = document.getElementById('community-filter');
  communities.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    communityFilter.appendChild(opt);
  });
  
  const assemblyFilter = document.getElementById('assembly-filter');
  assemblies.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    assemblyFilter.appendChild(opt);
  });
}

function toggleValidationFilter(filterType) {
  // Toggle filter: if already active, deactivate; otherwise activate
  if (activeValidationFilter === filterType) {
    activeValidationFilter = null;
  } else {
    activeValidationFilter = filterType;
  }
  
  // Persist to state
  state.setValidationFilter(activeValidationFilter);
  
  // Update chip appearances
  document.getElementById('validated-chip').classList.toggle('active', activeValidationFilter === 'validated');
  document.getElementById('not-validated-chip').classList.toggle('active', activeValidationFilter === 'not-validated');
  
  // Re-apply filters
  applyFilters();
}

function applyFilters() {
  const session = state.getSession();
  const { all: allOutlets } = state.getOutletsForAgent(session.agentId);
  
  // Get filter values
  const search = document.getElementById('search-input').value.toLowerCase();
  const community = document.getElementById('community-filter').value;
  const assembly = document.getElementById('assembly-filter').value;
  const outletType = document.getElementById('outlet-type-filter').value;
  // Persist filters to state
  state.setFilters({
    search,
    community,
    assembly,
    outlet_type: outletType,
  });
  
  // Filter outlets (combined view: not validated + validated)
  let filtered = allOutlets.filter(outlet => {
    // Apply filters
    if (search && !outlet.outlet_name.toLowerCase().includes(search)) return false;
    if (community && outlet.community !== community) return false;
    if (assembly && outlet.assembly !== assembly) return false;
    if (outletType && outlet.outlet_type !== outletType) return false;
    
    // Apply validation filter
    if (activeValidationFilter === 'validated' && !outlet._isValidated) return false;
    if (activeValidationFilter === 'not-validated' && outlet._isValidated) return false;
    
    return true;
  });
  
  // Update counters (show total counts, not filtered counts)
  const allFiltered = allOutlets.filter(outlet => {
    if (search && !outlet.outlet_name.toLowerCase().includes(search)) return false;
    if (community && outlet.community !== community) return false;
    if (assembly && outlet.assembly !== assembly) return false;
    if (outletType && outlet.outlet_type !== outletType) return false;
    return true;
  });
  const validated = allFiltered.filter(s => s._isValidated).length;
  const notValidated = allFiltered.length - validated;
  
  document.getElementById('validated-count').textContent = validated;
  document.getElementById('not-validated-count').textContent = notValidated;
  
  // Store filtered outlets for map view
  currentFilteredOutlets = filtered;
  // Persist for route-driven map
  state.setLastFiltered(filtered);
  
  // Update map button text
  const mapBtn = document.getElementById('map-fab');
  if (mapBtn) {
    mapBtn.innerHTML = `
      <svg class="map-fab-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
      </svg>
      Map (${filtered.length})
    `;
  }
  
  // Render outlets
  renderOutletCards(filtered);
}

function renderOutletCards(outlets) {
  const listEl = document.getElementById('outlets-list');
  
  if (outlets.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No outlets found</p>';
    return;
  }
  
  listEl.innerHTML = outlets.map(outlet => createOutletCard(outlet)).join('');
  
  // Initialize carousels
  outlets.forEach((outlet) => {
    const outletId = outlet.captured_id || outlet.assigned_outlet_id;
    createCarousel(`carousel-${outletId}`);
  });
  
  // Add click handlers
  outlets.forEach(outlet => {
    const outletId = outlet.captured_id || outlet.assigned_outlet_id;
    const card = document.getElementById(`card-${outletId}`);
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on carousel
      if (!e.target.closest('.carousel')) {
        window.location.hash = `#/detail/${outletId}`;
      }
    });
  });
}

function createOutletCard(outlet) {
  const validatedClass = outlet._isValidated ? 'validated' : 'not-validated';
  const validatedText = outlet._isValidated ? 'Validated' : 'Not validated';
  
  // Collect all available images
  const images = [];
  if (outlet.outlet_front_image) images.push(outlet.outlet_front_image);
  if (outlet.outlet_side_image) images.push(outlet.outlet_side_image);
  // Include product images from new array only
  if (Array.isArray(outlet.product_images) && outlet.product_images.length > 0) {
    outlet.product_images.forEach(url => { if (url) images.push(url); });
  }
  if (outlet.telescopic && outlet.telescopic_image) images.push(outlet.telescopic_image);
  
  // Fallback placeholder if no images
  if (images.length === 0) {
    images.push('https://via.placeholder.com/720x405/dddddd/666666?text=No+Image');
  }
  
  const outletId = outlet.captured_id || outlet.assigned_outlet_id;
  
  return `
    <div class="outlet-card" id="card-${outletId}">
      <div class="carousel" id="carousel-${outletId}">
        <div class="carousel-track">
          ${images.map(img => `
            <div class="carousel-slide">
              <img src="${img}" alt="${outlet.outlet_name}" loading="lazy">
            </div>
          `).join('')}
        </div>
        <div class="carousel-badge badge badge-${validatedClass}">
          ${validatedText}
        </div>
        <div class="carousel-dots">
          ${images.map((_, i) => `<div class="carousel-dot ${i === 0 ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>
      
      <div class="card-content">
        <div class="card-header">
          <h3>${outlet.outlet_name}</h3>
          <span class="badge badge-${outlet.outlet_type}">${outlet.outlet_type}</span>
        </div>
        
        <div class="card-meta">
          <span>${outlet.community} • ${outlet.assembly}</span>
        </div>
        
        <div class="card-contact">
          <span>${outlet.contact_name} • ${outlet.contact_phone}</span>
        </div>
        <div class="card-attributes">
          ${outlet.headerboard ? '<span class="badge">Headerboard</span>' : ''}
          ${outlet.painted ? '<span class="badge">Painted</span>' : ''}
          ${outlet.telescopic ? '<span class="badge">Telescopic</span>' : ''}
          ${outlet.outlet_type === 'salon' && outlet.number_of_stylists > 0 ? `<span class="badge">${outlet.number_of_stylists} Stylists</span>` : ''}
        </div>
      </div>
      </div>
    `;
  }

 
function openMapView() {
  if (currentFilteredOutlets.length === 0) {
    alert('No outlets to display on map');
    return;
  }
  // Ensure latest filtered set is in state and navigate to map route
  state.setLastFiltered(currentFilteredOutlets);
  window.location.hash = '#/map';
}

async function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      await supabaseSignOut();
      state.clearSession();
      window.location.hash = '#/signin';
    } catch (err) {
      console.error('Sign out error:', err);
      alert('Failed to sign out. Please try again.');
    }
  }
}

function addListStyles() {
  if (document.getElementById('list-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'list-styles';
  style.textContent = `
    .list-view {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .list-header {
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      background-color: white;
    }
    
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header-top h1 {
      font-size: 16px;
      font-weight: 700;
    }
    
    .header-subtitle {
      color: var(--secondary-color);
      font-size: 14px;
      margin-top: 4px;
    }
    
    .btn-icon {
      background: none;
      color: var(--accent-color);
      font-size: 14px;
      font-weight: 600;
    }
    
    .filters-section {
      padding: 16px;
      background-color: #F7F7F7;
      border-bottom: 1px solid var(--border-color);
    }
    
    .list-header,
    .filters-section {
      position: sticky;
      top: 0;
      z-index: 10;
      flex-shrink: 0;
    }
    
    .search-box {
      margin-bottom: 12px;
    }
    
    .filters-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .filters-row select {
      font-size: 14px;
      padding: 8px 12px;
    }
    
    .validation-filter-chips {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    
    .validation-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 2px solid var(--border-color);
      border-radius: 20px;
      background-color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      flex: 1;
    }
    
    .validation-chip:active {
      transform: scale(0.98);
    }
    
    .validation-chip .chip-label {
      color: var(--text-color);
      flex: 1;
    }
    
    .validation-chip .chip-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      background-color: var(--border-color);
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary-color);
    }
    
    .validation-chip.active {
      border-color: var(--primary-color);
      background-color: var(--primary-color);
    }
    
    .validation-chip.active .chip-label {
      color: white;
    }
    
    .validation-chip.active .chip-count {
      background-color: rgba(255, 255, 255, 0.25);
      color: white;
    }
    
    .outlets-list {
      padding: 16px;
      padding-bottom: 100px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .outlet-card {
      background: white;
      border-radius: var(--card-radius);
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      cursor: pointer;
    }
    
    .carousel {
      position: relative;
    }
    
    .carousel-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 2;
    }
    
    .card-content {
      padding: 12px;
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .card-header h3 {
      font-size: 16px;
      font-weight: 600;
    }
    
    .card-meta, .card-contact {
      font-size: 14px;
      color: var(--secondary-color);
      margin-bottom: 8px;
    }
    
    .card-attributes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    
    .card-attributes .badge {
      font-size: 12px;
      padding: 3px 8px;
    }
    
    .empty-state {
      text-align: center;
      color: var(--secondary-color);
      padding: 40px 16px;
    }
  `;
  
  document.head.appendChild(style);
}
