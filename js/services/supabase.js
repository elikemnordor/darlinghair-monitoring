// Supabase client singleton
import { SUPABASE_CONFIG } from '../config/supabase.config.js';

// Supabase client instance (will be initialized after SDK loads)
let supabaseClient = null;

// Initialize Supabase client
export function initSupabase() {
  if (!window.supabase) {
    console.error('Supabase SDK not loaded. Include it in index.html before app.js');
    return null;
  }
  
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );
    console.log('Supabase client initialized');
  }
  
  return supabaseClient;
}

// Get existing client (must call initSupabase first)
export function getSupabase() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}

// Auth helpers
export async function signInWithPassword(email, password) {
  const supabase = getSupabase();
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email, password) {
  const supabase = getSupabase();
  return await supabase.auth.signUp({ email, password });
}

export async function signOut() {
  const supabase = getSupabase();
  return await supabase.auth.signOut();
}

export async function getSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function resetPasswordForEmail(email, redirectTo) {
  const supabase = getSupabase();
  return await supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

// Listen to auth state changes
export function onAuthStateChange(callback) {
  const supabase = getSupabase();
  return supabase.auth.onAuthStateChange(callback);
}

// Get agent profile for current user
export async function getAgentProfile(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('agent_id, name')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error('Failed to fetch agent profile:', error);
    return null;
  }
  
  return data;
}

// Get assigned outlets for current user
export async function getAssignedOutlets() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('assigned_outlets')
    .select('*')
    .order('assigned_outlet_id');
  
  if (error) {
    console.error('Failed to fetch assigned outlets:', error);
    return null;
  }
  
  return data;
}

// Get captured outlets for current user
export async function getCapturedOutlets() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('captured_outlets')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to fetch captured outlets:', error);
    return null;
  }
  
  return data;
}

// Create or update captured outlet
export async function upsertCapturedOutlet(capturedOutlet) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('captured_outlets')
    .upsert(capturedOutlet, {
      onConflict: 'captured_id'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to upsert captured outlet:', error);
    return { error };
  }
  
  return { data };
}

// Delete captured outlet
export async function deleteCapturedOutlet(capturedId) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('captured_outlets')
    .delete()
    .eq('captured_id', capturedId);
  
  if (error) {
    console.error('Failed to delete captured outlet:', error);
    return { error };
  }
  
  return { success: true };
}

// ============================================
// Storage helpers
// ============================================

/**
 * Upload image to Supabase Storage
 * @param {File} file - Image file to upload
 * @param {string} folder - Folder name (e.g., user_id)
 * @param {string} filename - Filename without extension
 * @returns {Promise<{url: string, path: string} | {error: any}>}
 */
export async function uploadImage(file, folder, filename) {
  const supabase = getSupabase();
  
  // Generate unique filename with timestamp
  const ext = file.name.split('.').pop();
  const timestamp = Date.now();
  const filePath = `${folder}/${filename}_${timestamp}.${ext}`;
  
  const { data, error } = await supabase.storage
    .from('outlet-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false // fail if file exists (shouldn't happen with timestamp)
    });
  
  if (error) {
    console.error('Failed to upload image:', error);
    return { error };
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('outlet-images')
    .getPublicUrl(filePath);
  
  return {
    url: urlData.publicUrl,
    path: filePath
  };
}

/**
 * Delete image from Supabase Storage
 * @param {string} path - Storage path (e.g., "user_id/outlet_front_cap_123_1234567890.jpg")
 * @returns {Promise<{success: boolean} | {error: any}>}
 */
export async function deleteImage(path) {
  const supabase = getSupabase();
  
  const { error } = await supabase.storage
    .from('outlet-images')
    .remove([path]);
  
  if (error) {
    console.error('Failed to delete image:', error);
    return { error };
  }
  
  return { success: true };
}

/**
 * Extract storage path from URL
 * @param {string} url - Storage URL
 * @returns {string|null} - Storage path or null
 */
export function getStoragePathFromUrl(url) {
  if (!url || !url.includes('/storage/v1/object/')) return null;
  
  // URL format: https://<project>.supabase.co/storage/v1/object/public/outlet-images/<path>
  const match = url.match(/\/storage\/v1\/object\/[^/]+\/outlet-images\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Check if a URL is a data URL (base64)
 * @param {string} url
 * @returns {boolean}
 */
export function isDataUrl(url) {
  return url && url.startsWith('data:');
}

/**
 * Convert data URL to Blob
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

// ============================================
// Products helpers (minimal)
// ============================================

/**
 * Fetch active products for selection UI
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getProducts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, active, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) {
    console.warn('Failed to fetch products:', error.message);
    return [];
  }
  return (data || []).map(p => ({ id: p.id, name: p.name }));
}
