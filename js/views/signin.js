// Sign-in view
import { state } from '../state.js';
import { signInWithPassword } from '../services/supabase.js';

export function renderSignIn() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="signin-view">
      <div class="signin-container">
        <div class="signin-brand">
          <img src="logo.svg" alt="Client Logo" class="signin-logo"/>
        </div>
        <div class="signin-header">
          <h1>Outlet Directory</h1>
          <p>Sign in to continue</p>
        </div>
        
        <form class="signin-form" id="signin-form">
          <div class="form-group">
            <label for="email-input">Email</label>
            <input type="email" id="email-input" placeholder="agent@example.com" required>
          </div>
          
          <div class="form-group">
            <label for="password-input">Password</label>
            <input type="password" id="password-input" placeholder="Enter your password" required>
          </div>
          
          <div id="error-message" class="error-message" style="display: none;"></div>
          
          <button type="submit" class="btn-primary" id="signin-btn">Sign In</button>
        </form>
      </div>
    </div>
  `;
  
  // Handle sign-in
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const signInBtn = document.getElementById('signin-btn');
  const errorMessage = document.getElementById('error-message');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSignIn(emailInput.value, passwordInput.value, signInBtn, errorMessage);
  });
}

async function handleSignIn(email, password, button, errorEl) {
  console.log('🔍 [signin.js] handleSignIn() called for email:', email);
  if (!email || !password) {
    showError(errorEl, 'Please enter email and password');
    return;
  }
  
  try {
    button.disabled = true;
    button.textContent = 'Signing in...';
    hideError(errorEl);
    
    console.log('🔍 [signin.js] Calling signInWithPassword...');
    const { data, error } = await signInWithPassword(email, password);
    console.log('🔍 [signin.js] signInWithPassword result - data:', data, 'error:', error);
    
    if (error) {
      console.log('🔍 [signin.js] Sign-in error:', error.message);
      showError(errorEl, error.message);
      button.disabled = false;
      button.textContent = 'Sign In';
      return;
    }
    
    if (data.session) {
      console.log('🔍 [signin.js] Session returned, setting hash to #/list');
      console.log('🔍 [signin.js] Current state.getSession():', state.getSession());
      // Session will be handled by auth state listener in app.js
      window.location.hash = '#/list';
      console.log('🔍 [signin.js] Hash changed to:', window.location.hash);
    }
  } catch (err) {
    console.error('Sign in error:', err);
    showError(errorEl, 'An unexpected error occurred. Please try again.');
    button.disabled = false;
    button.textContent = 'Sign In';
  }
}


function showError(el, message, type = 'error') {
  el.textContent = message;
  el.style.display = 'block';
  el.style.color = type === 'success' ? 'var(--success-color)' : '#d32f2f';
}

function hideError(el) {
  el.style.display = 'none';
  el.textContent = '';
}
