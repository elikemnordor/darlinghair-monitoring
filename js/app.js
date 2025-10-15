// Main application entry point
import { router } from './router.js';
import { state } from './state.js';
import { initSupabase, onAuthStateChange } from './services/supabase.js';

// Initialize app
async function init() {
  console.log('Outlet Directory App initializing...');
  
  // Debug log filter: hide lines starting with the debug marker unless window.DEBUG is true
  try {
    if (typeof window !== 'undefined') {
      window.DEBUG = window.DEBUG ?? true;
      const __origLog = console.log.bind(console);
      console.log = function(...args) {
        const first = args[0];
        if (typeof first === 'string' && first.startsWith('🔍')) {
          if (window.DEBUG) {
            return __origLog(...args);
          }
          return; // suppress debug log
        }
        return __origLog(...args);
      };
    }
  } catch (_) {
    // no-op if console patch fails
  }
  
  // Initialize Supabase client
  initSupabase();
  
  // Set up auth state listener
  onAuthStateChange((event, session) => {
    console.log('🔍 [app.js] Auth state changed:', event, session?.user?.email);
    if (event === 'SIGNED_IN' && session) {
      console.log('🔍 [app.js] SIGNED_IN event detected, calling state.setSupabaseSession()');
      state.setSupabaseSession(session).then(() => {
        console.log('🔍 [app.js] After setSupabaseSession, state.getSession():', state.getSession());
        // Navigate to list view after session is set
        if (window.location.hash === '#/signin' || window.location.hash === '') {
          console.log('🔍 [app.js] Navigating to #/list after sign-in');
          window.location.hash = '#/list';
        }
      });
    } else if (event === 'SIGNED_OUT') {
      console.log('🔍 [app.js] SIGNED_OUT event detected');
      state.clearSession();
      window.location.hash = '#/signin';
    }
  });
  
  // Check if user is signed in
  console.log('🔍 [app.js] Initializing session...');
  await state.initializeSession();
  const session = state.getSession();
  console.log('🔍 [app.js] Session after initialization:', session);
  
  if (!session && window.location.hash !== '#/signin') {
    console.log('🔍 [app.js] No session, redirecting to #/signin');
    window.location.hash = '#/signin';
  }
  
  // Initialize router
  console.log('🔍 [app.js] Initializing router...');
  router.init();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
