/**
 * Google OAuth Authentication Service
 * Uses Google Identity Services (GIS) for modern OAuth 2.0 flow
 */

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  idToken: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface DecodedJWT {
  sub: string;
  email: string;
  name: string;
  picture: string;
  exp: number;
  iat: number;
}

const STORAGE_KEY = 'gear_pr_review_google_user';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let googleInitialized = false;
let onAuthChangeCallback: ((user: GoogleUser | null) => void) | null = null;

/**
 * Decode JWT token without external library
 */
function decodeJWT(token: string): DecodedJWT {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

/**
 * Check if token is expired
 */
function isTokenExpired(idToken: string): boolean {
  try {
    const decoded = decodeJWT(idToken);
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch {
    return true;
  }
}

/**
 * Load Google Identity Services script
 */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-gsi-script')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Handle credential response from Google
 */
function handleCredentialResponse(response: GoogleCredentialResponse): void {
  try {
    const decoded = decodeJWT(response.credential);
    const user: GoogleUser = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      idToken: response.credential,
    };

    // Store user in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

    // Notify listeners
    if (onAuthChangeCallback) {
      onAuthChangeCallback(user);
    }
  } catch (error) {
    console.error('Failed to decode Google credential:', error);
  }
}

/**
 * Initialize Google OAuth
 * Must be called before any auth operations
 */
export async function initGoogleAuth(): Promise<void> {
  if (!CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID not configured. Google OAuth disabled.');
    return;
  }

  if (googleInitialized) {
    return;
  }

  await loadGoogleScript();

  // Wait for google object to be available
  await new Promise<void>((resolve) => {
    const checkGoogle = () => {
      if (window.google?.accounts?.id) {
        resolve();
      } else {
        setTimeout(checkGoogle, 100);
      }
    };
    checkGoogle();
  });

  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: true,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true,
  });

  googleInitialized = true;
}

/**
 * Trigger Google Sign-In popup
 */
export function signIn(): Promise<GoogleUser> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID.'));
      return;
    }

    if (!googleInitialized || !window.google?.accounts?.id) {
      reject(new Error('Google OAuth not initialized. Call initGoogleAuth() first.'));
      return;
    }

    // Set up one-time callback
    const originalCallback = onAuthChangeCallback;
    onAuthChangeCallback = (user) => {
      onAuthChangeCallback = originalCallback;
      if (user) {
        resolve(user);
      } else {
        reject(new Error('Sign-in cancelled'));
      }
    };

    // Prompt user to sign in
    window.google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render button in a modal or use redirect
        onAuthChangeCallback = originalCallback;
        reject(new Error('Google Sign-In prompt not displayed. Try again or check popup blockers.'));
      }
    });
  });
}

/**
 * Sign out user
 */
export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
  
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  if (onAuthChangeCallback) {
    onAuthChangeCallback(null);
  }
}

/**
 * Get stored user from localStorage
 * Returns null if not authenticated or token expired
 */
export function getStoredUser(): GoogleUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const user: GoogleUser = JSON.parse(stored);
    
    // Check if token is expired
    if (isTokenExpired(user.idToken)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getStoredUser() !== null;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (user: GoogleUser | null) => void): () => void {
  onAuthChangeCallback = callback;
  return () => {
    onAuthChangeCallback = null;
  };
}

/**
 * Check if Google OAuth is configured
 */
export function isOAuthConfigured(): boolean {
  return !!CLIENT_ID;
}

/**
 * Get the current ID token for API calls
 */
export function getIdToken(): string | null {
  const user = getStoredUser();
  return user?.idToken || null;
}

// TypeScript declarations for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
          }) => void) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              width?: number;
            }
          ) => void;
          disableAutoSelect: () => void;
          revoke: (email: string, callback: () => void) => void;
        };
      };
    };
  }
}
