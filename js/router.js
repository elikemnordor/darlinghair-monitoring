// Simple hash-based router
import { renderSignIn } from './views/signin.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderMap } from './views/map.js';
import { state } from './state.js';

const routes = {
  '/signin': renderSignIn,
  '/list': renderList,
  '/detail': renderDetail,
  '/map': renderMap,
};

function navigate() {
  const hash = window.location.hash.slice(1) || '/signin';
  const [path, ...params] = hash.split('/').filter(Boolean);
  const route = `/${path}`;
  console.log('🔍 [router.js] navigate() called for route:', route, 'hash:', window.location.hash);
  
  // Check authentication for protected routes
  const session = state.getSession();
  console.log('🔍 [router.js] Current session:', session);
  if (!session && route !== '/signin') {
    console.log('🔍 [router.js] No session and not on /signin, redirecting to #/signin');
    window.location.hash = '#/signin';
    return;
  }
  
  // Render the appropriate view
  const renderFn = routes[route];
  if (renderFn) {
    console.log('🔍 [router.js] Rendering view for route:', route);
    renderFn(params);
  } else {
    console.log('🔍 [router.js] No route found, defaulting to:', session ? '#/list' : '#/signin');
    // Default to list if signed in, signin otherwise
    window.location.hash = session ? '#/list' : '#/signin';
  }
}

function init() {
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    console.log('🔍 [router.js] hashchange event fired, new hash:', window.location.hash);
    navigate();
  });
  
  // Handle initial route
  console.log('🔍 [router.js] Router init - handling initial route');
  navigate();
}

export const router = {
  init,
  navigate,
};
