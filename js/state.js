// Application state management
import { 
  getSession as getSupabaseSession, 
  getAgentProfile,
  getCapturedOutlets as fetchCapturedOutletsFromSupabase,
  upsertCapturedOutlet as upsertCapturedOutletToSupabase,
  deleteCapturedOutlet as deleteCapturedOutletFromSupabase,
  deleteImage,
  getStoragePathFromUrl,
  isDataUrl,
  getProducts
} from './services/supabase.js';

const STATE_KEY = 'outlets_app_state';
const CAPTURED_KEY = 'captured_outlets';

let appState = {
  session: null, // { userId, agentId, agentName, email }
  assignedOutlets: [], // immutable reference data
  capturedOutlets: [], // agent-submitted validated outlets (persisted separately)
  agents: [],
  lastOutletsFetchAt: 0, // timestamp of last successful fetch of assigned/captured from server
  products: [],
  lastProductsFetchAt: 0, // timestamp of last successful fetch of products
  filters: {
    community: '',
    assembly: '',
    outlet_type: '',
    search: '',
    validationFilter: null, // null, 'validated', or 'not-validated'
  },
  lastFiltered: [],
  mapSelectedOutletId: null,
};

// Load state from localStorage
function loadState() {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only restore lightweight UI state (not outlet data from Supabase)
      if (parsed.session) appState.session = parsed.session;
      if (parsed.filters) appState.filters = parsed.filters;
      if (parsed.mapSelectedOutletId) appState.mapSelectedOutletId = parsed.mapSelectedOutletId;
      // Note: lastFiltered is NOT restored (temporary cache, regenerated on filter)
    }
    
    // Clean up legacy large data (migration)
    localStorage.removeItem(CAPTURED_KEY); // No longer needed, using Supabase
  } catch (err) {
    console.error('Failed to load state:', err);
  }
}

// Save state to localStorage (lightweight UI state only, not outlet data)
function saveState() {
  try {
    const lightweightState = {
      session: appState.session,
      filters: appState.filters,
      mapSelectedOutletId: appState.mapSelectedOutletId,
      // Note: lastFiltered is NOT saved (temporary cache, too large)
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(lightweightState));
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

// Legacy: Save captured outlets separately (deprecated - now using Supabase)
function saveCapturedOutlets() {
  // No-op: captured outlets now saved to Supabase, not localStorage
  // Keeping function for backward compatibility
}

// Session management
async function initializeSession() {
  // Check if we have a Supabase session
  const supabaseSession = await getSupabaseSession();
  
  if (supabaseSession?.user) {
    const userId = supabaseSession.user.id;
    const email = supabaseSession.user.email;
    
    // Query agent_profiles to map user to agent
    const agentProfile = await getAgentProfile(userId);
    
    if (agentProfile) {
      appState.session = {
        userId,
        agentId: agentProfile.agent_id,
        agentName: agentProfile.name,
        email,
      };
    } else {
      // Fallback if no profile found (shouldn't happen in production)
      console.warn('No agent profile found for user:', userId);
      appState.session = {
        userId,
        agentId: userId,
        agentName: email,
        email,
      };
    }
    saveState();
  }
}

async function setSupabaseSession(supabaseSession) {
  console.log('🔍 [state.js] setSupabaseSession() called with:', supabaseSession?.user?.email);
  if (supabaseSession?.user) {
    const userId = supabaseSession.user.id;
    const email = supabaseSession.user.email;
    
    console.log('🔍 [state.js] Querying agent profile for userId:', userId);
    // Query agent_profiles to map user to agent
    const agentProfile = await getAgentProfile(userId);
    console.log('🔍 [state.js] Agent profile result:', agentProfile);
    
    if (agentProfile) {
      appState.session = {
        userId,
        agentId: agentProfile.agent_id,
        agentName: agentProfile.name,
        email,
      };
    } else {
      // Fallback if no profile found
      console.warn('No agent profile found for user:', userId);
      appState.session = {
        userId,
        agentId: userId,
        agentName: email,
        email,
      };
    }
    console.log('🔍 [state.js] Session set to:', appState.session);
    saveState();
    // Force next outlets load to fetch fresh data
    appState.lastOutletsFetchAt = 0;
  } else {
    console.log('🔍 [state.js] setSupabaseSession() called with invalid session');
  }
}

function setSession(agentId, agentName) {
  // Legacy method for backward compatibility (dropdown signin)
  appState.session = { agentId, agentName };
  saveState();
}

function getSession() {
  console.log('🔍 [state.js] getSession() called, returning:', appState.session);
  return appState.session;
}

function clearSession() {
  // Clear session and reset app-scoped persisted pieces
  appState.session = null;
  appState.filters = {
    community: '',
    assembly: '',
    outlet_type: '',
    search: '',
    validationFilter: null,
  };
  appState.lastFiltered = [];
  appState.mapSelectedOutletId = null;
  appState.lastOutletsFetchAt = 0;
  appState.products = [];
  appState.lastProductsFetchAt = 0;
  try {
    localStorage.removeItem(STATE_KEY);
    // Note: captured outlets persist across sessions (not cleared on sign out)
  } catch (err) {
    console.warn('Failed to clear localStorage:', err);
  }
}

// Assigned outlets management (immutable reference)
function setAssignedOutlets(outlets) {
  appState.assignedOutlets = outlets;
}

function getAssignedOutlets() {
  return appState.assignedOutlets;
}

// Set captured outlets (from Supabase or localStorage)
function setCapturedOutlets(outlets) {
  appState.capturedOutlets = outlets;
}

// Outlets fetch cache helpers
function markOutletsFetched() {
  appState.lastOutletsFetchAt = Date.now();
}

function shouldRefetchOutlets(ttlMs = 60000) {
  const now = Date.now();
  if (!appState.assignedOutlets || appState.assignedOutlets.length === 0) return true;
  return (now - (appState.lastOutletsFetchAt || 0)) > ttlMs;
}

function forceRefetchOutlets() {
  appState.lastOutletsFetchAt = 0;
}

// Products fetch cache helpers
async function getProductsCached(ttlMs = 300000) { // default 5 minutes
  const now = Date.now();
  const expired = (now - (appState.lastProductsFetchAt || 0)) > ttlMs;
  if (!Array.isArray(appState.products) || appState.products.length === 0 || expired) {
    try {
      const items = await getProducts();
      appState.products = items || [];
      appState.lastProductsFetchAt = Date.now();
    } catch (err) {
      console.warn('Failed to fetch products (using cache if any):', err);
    }
  }
  return appState.products || [];
}

function forceRefetchProducts() {
  appState.lastProductsFetchAt = 0;
}

// Captured outlets management (mutable, agent-submitted)
function getCapturedOutlets() {
  return appState.capturedOutlets;
}

async function createCapturedOutlet(capturedOutlet) {
  const session = getSession();
  const capturedId = `cap_${capturedOutlet.assigned_outlet_id}_${capturedOutlet.agent_id}`;
  const newRecord = {
    ...capturedOutlet,
    captured_id: capturedId,
    agent_user_id: session.userId, // Supabase user ID for RLS
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  // Try Supabase first
  try {
    const { data, error } = await upsertCapturedOutletToSupabase(newRecord);
    if (error) throw error;
    
    // Update local state
    appState.capturedOutlets = appState.capturedOutlets.filter(
      c => c.captured_id !== capturedId
    );
    appState.capturedOutlets.push(data);
    
    console.log('✅ Captured outlet saved to Supabase:', capturedId);
    return data;
  } catch (err) {
    console.warn('Supabase save failed, using localStorage:', err.message);
    
    // Fallback to localStorage
    appState.capturedOutlets = appState.capturedOutlets.filter(
      c => c.captured_id !== capturedId
    );
    appState.capturedOutlets.push(newRecord);
    saveCapturedOutlets();
    return newRecord;
  }
}

async function updateCapturedOutlet(capturedId, updates) {
  const session = getSession();
  const index = appState.capturedOutlets.findIndex(c => c.captured_id === capturedId);
  
  if (index === -1) return false;
  
  const updatedRecord = {
    ...appState.capturedOutlets[index],
    ...updates,
    agent_user_id: session.userId,
    updated_at: new Date().toISOString(),
  };
  
  // Try Supabase first
  try {
    const { data, error } = await upsertCapturedOutletToSupabase(updatedRecord);
    if (error) throw error;
    
    // Update local state
    appState.capturedOutlets[index] = data;
    console.log('✅ Captured outlet updated in Supabase:', capturedId);
    return true;
  } catch (err) {
    console.warn('Supabase update failed, using localStorage:', err.message);
    
    // Fallback to localStorage
    appState.capturedOutlets[index] = updatedRecord;
    saveCapturedOutlets();
    return true;
  }
}

async function deleteCapturedOutlet(capturedId) {
  // Find the outlet to get image URLs before deleting
  const outlet = appState.capturedOutlets.find(c => c.captured_id === capturedId);
  
  // Try Supabase first
  try {
    const { error } = await deleteCapturedOutletFromSupabase(capturedId);
    if (error) throw error;
    
    // Delete associated images from Storage (arrays + legacy fields)
    if (outlet) {
      const imageUrls = [];
      // Core images
      if (outlet.outlet_front_image) imageUrls.push(outlet.outlet_front_image);
      if (outlet.outlet_side_image) imageUrls.push(outlet.outlet_side_image);
      if (outlet.telescopic_image) imageUrls.push(outlet.telescopic_image);
      // New per-product array
      if (Array.isArray(outlet.product_images)) {
        for (const url of outlet.product_images) {
          if (url) imageUrls.push(url);
        }
      }
      // Backward-compat legacy per-product fields (if any remain in old records)
      if (outlet.product_a_image) imageUrls.push(outlet.product_a_image);
      if (outlet.product_b_image) imageUrls.push(outlet.product_b_image);
      if (outlet.product_c_image) imageUrls.push(outlet.product_c_image);

      for (const url of imageUrls) {
        if (url && !isDataUrl(url)) {
          const storagePath = getStoragePathFromUrl(url);
          if (storagePath) {
            await deleteImage(storagePath);
            console.log(`🗑️ Deleted image from Storage: ${storagePath}`);
          }
        }
      }
    }
    
    // Update local state
    const initialLength = appState.capturedOutlets.length;
    appState.capturedOutlets = appState.capturedOutlets.filter(
      c => c.captured_id !== capturedId
    );
    
    console.log('✅ Captured outlet deleted from Supabase:', capturedId);
    return appState.capturedOutlets.length < initialLength;
  } catch (err) {
    console.warn('Supabase delete failed, using localStorage:', err.message);
    
    // Fallback to localStorage
    const initialLength = appState.capturedOutlets.length;
    appState.capturedOutlets = appState.capturedOutlets.filter(
      c => c.captured_id !== capturedId
    );
    if (appState.capturedOutlets.length < initialLength) {
      saveCapturedOutlets();
      return true;
    }
    return false;
  }
}

// Combined view for agent
function getOutletsForAgent(agentId) {
  const assigned = appState.assignedOutlets.filter(a => a.agent_id === agentId);
  const captured = appState.capturedOutlets.filter(c => c.agent_id === agentId);
  const capturedSet = new Set(captured.map(c => c.assigned_outlet_id));
  
  // Not validated: assigned entries without a captured record
  const notValidated = assigned.filter(a => !capturedSet.has(a.assigned_outlet_id));
  
  // Validated: captured entries (with _isValidated flag for UI)
  const validated = captured.map(c => ({ ...c, _isValidated: true }));
  
  return {
    notValidated,
    validated,
    all: [...notValidated, ...validated],
  };
}

// Get outlet by ID (checks both tables)
function getOutletById(id, agentId) {
  // First check captured (if it's a captured_id)
  const captured = appState.capturedOutlets.find(c => c.captured_id === id && c.agent_id === agentId);
  if (captured) return { ...captured, _isValidated: true };
  
  // Then check assigned (if it's an assigned_outlet_id)
  const assigned = appState.assignedOutlets.find(a => a.assigned_outlet_id === id && a.agent_id === agentId);
  if (assigned) {
    // Check if this has been captured
    const capturedForThis = appState.capturedOutlets.find(
      c => c.assigned_outlet_id === assigned.assigned_outlet_id && c.agent_id === agentId
    );
    if (capturedForThis) return { ...capturedForThis, _isValidated: true };
    return { ...assigned, _isValidated: false };
  }
  
  return null;
}

function getCapturedByAssignedId(assignedOutletId, agentId) {
  return appState.capturedOutlets.find(
    c => c.assigned_outlet_id === assignedOutletId && c.agent_id === agentId
  );
}

function setAgents(agents) {
  appState.agents = agents;
}

function getAgents() {
  return appState.agents;
}

// Filter management
function setFilters(filters) {
  appState.filters = { ...appState.filters, ...filters };
  saveState();
}

function getFilters() {
  return appState.filters;
}

function setValidationFilter(filter) {
  appState.filters.validationFilter = filter;
  saveState();
}

function getValidationFilter() {
  return appState.filters.validationFilter;
}

function clearFilters() {
  appState.filters = {
    community: '',
    assembly: '',
    outlet_type: '',
    search: '',
  };
}

// Map/list bridge helpers
function setLastFiltered(outlets) {
  appState.lastFiltered = outlets;
}

function getLastFiltered() {
  return appState.lastFiltered || [];
}

function setMapSelectedOutletId(id) {
  appState.mapSelectedOutletId = id;
}

function getMapSelectedOutletId() {
  return appState.mapSelectedOutletId;
}

// Initialize state on module load
loadState();

export const state = {
  initializeSession,
  setSupabaseSession,
  setSession,
  getSession,
  clearSession,
  setAssignedOutlets,
  getAssignedOutlets,
  setCapturedOutlets,
  getCapturedOutlets,
  createCapturedOutlet,
  updateCapturedOutlet,
  deleteCapturedOutlet,
  getOutletsForAgent,
  getOutletById,
  getCapturedByAssignedId,
  setAgents,
  getAgents,
  setFilters,
  getFilters,
  clearFilters,
  setValidationFilter,
  getValidationFilter,
  setLastFiltered,
  getLastFiltered,
  setMapSelectedOutletId,
  getMapSelectedOutletId,
  // cache helpers
  markOutletsFetched,
  shouldRefetchOutlets,
  forceRefetchOutlets,
  getProductsCached,
  forceRefetchProducts,
};
