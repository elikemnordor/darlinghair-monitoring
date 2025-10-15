// Sign-in view
import { state } from '../state.js';
import { signInWithPassword, signUpWithPassword } from '../services/supabase.js';

export function renderSignIn() {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="signin-view">
      <div class="signin-container">
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
          <button type="button" class="btn-secondary" id="signup-btn">Create Account</button>
        </form>
        
        <div class="signin-footer">
          <button type="button" class="btn-link" id="forgot-password-btn">Forgot Password?</button>
        </div>
      </div>
    </div>
  `;
  
  addSignInStyles();
  
  // Handle sign-in
  const form = document.getElementById('signin-form');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const signInBtn = document.getElementById('signin-btn');
  const signUpBtn = document.getElementById('signup-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const errorMessage = document.getElementById('error-message');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSignIn(emailInput.value, passwordInput.value, signInBtn, errorMessage);
  });
  
  signUpBtn.addEventListener('click', async () => {
    await handleSignUp(emailInput.value, passwordInput.value, signUpBtn, errorMessage);
  });
  
  forgotPasswordBtn.addEventListener('click', () => {
    handleForgotPassword(emailInput.value);
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

async function handleSignUp(email, password, button, errorEl) {
  if (!email || !password) {
    showError(errorEl, 'Please enter email and password');
    return;
  }
  
  if (password.length < 6) {
    showError(errorEl, 'Password must be at least 6 characters');
    return;
  }
  
  try {
    button.disabled = true;
    button.textContent = 'Creating account...';
    hideError(errorEl);
    
    const { data, error } = await signUpWithPassword(email, password);
    
    if (error) {
      showError(errorEl, error.message);
      button.disabled = false;
      button.textContent = 'Create Account';
      return;
    }
    
    if (data.session) {
      // Auto-signed in
      window.location.hash = '#/list';
    } else if (data.user) {
      // Email confirmation required
      showError(errorEl, 'Account created! Please check your email to confirm your account.', 'success');
      button.disabled = false;
      button.textContent = 'Create Account';
    }
  } catch (err) {
    console.error('Sign up error:', err);
    showError(errorEl, 'An unexpected error occurred. Please try again.');
    button.disabled = false;
    button.textContent = 'Create Account';
  }
}

function handleForgotPassword(email) {
  if (!email) {
    alert('Please enter your email address first');
    return;
  }
  
  alert('Password reset feature coming soon. Contact your administrator for now.');
  // TODO: Implement resetPasswordForEmail when needed
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

function addSignInStyles() {
  if (document.getElementById('signin-extra-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'signin-extra-styles';
  style.textContent = `
    .error-message {
      padding: 12px;
      border-radius: 8px;
      background-color: #ffebee;
      color: #d32f2f;
      font-size: 14px;
      margin-bottom: 16px;
      text-align: center;
    }
    
    .signin-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .signin-footer {
      text-align: center;
      margin-top: 16px;
    }
    
    .btn-link {
      background: none;
      border: none;
      color: var(--accent-color);
      font-size: 14px;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    }
    
    .btn-link:hover {
      color: #E31C5F;
    }
  `;
  
  document.head.appendChild(style);
}
