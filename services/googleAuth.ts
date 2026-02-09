/**
 * Google OAuth Authentication Service
 * Uses Authorization Code Flow to get tokens for Gemini API access
 */

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  idToken: string;
  hasGeminiAccess?: boolean;
}

interface DecodedJWT {
  sub: string;
  email: string;
  name: string;
  picture: string;
  exp: number;
  iat: number;
}

interface CodeClientConfig {
  client_id: string;
  scope: string;
  callback: (response: { code?: string; error?: string }) => void;
  ux_mode?: 'popup' | 'redirect';
  redirect_uri?: string;
  state?: string;
  select_account?: boolean;
  hint?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
  prompt?: string;
}

const STORAGE_KEY = 'gear_pr_review_google_user';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://proxy.hoainho.info';

const BASE_SCOPES = 'openid email profile';

let googleInitialized = false;
let codeClient: { requestCode: () => void } | null = null;
let onAuthChangeCallback: ((user: GoogleUser | null) => void) | null = null;
let pendingAuthResolve: ((user: GoogleUser) => void) | null = null;
let pendingAuthReject: ((error: Error) => void) | null = null;

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

function isTokenExpired(idToken: string): boolean {
  try {
    const decoded = decodeJWT(idToken);
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch {
    return true;
  }
}

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

async function exchangeCodeForTokens(code: string): Promise<GoogleUser> {
  const response = await fetch(`${PROXY_URL}/v0/auth/google/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: window.location.origin,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Token exchange failed');
  }

  const user: GoogleUser = {
    id: data.user_id || data.email,
    email: data.email,
    name: data.name || data.email.split('@')[0],
    picture: data.picture || '',
    idToken: data.id_token || '',
    hasGeminiAccess: data.has_gemini_access ?? true,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

  if (onAuthChangeCallback) {
    onAuthChangeCallback(user);
  }

  return user;
}

function handleCodeResponse(response: { code?: string; error?: string }): void {
  if (response.error) {
    console.error('Google auth error:', response.error);
    if (pendingAuthReject) {
      pendingAuthReject(new Error(response.error));
      pendingAuthReject = null;
      pendingAuthResolve = null;
    }
    return;
  }

  if (response.code) {
    exchangeCodeForTokens(response.code)
      .then((user) => {
        if (pendingAuthResolve) {
          pendingAuthResolve(user);
          pendingAuthResolve = null;
          pendingAuthReject = null;
        }
      })
      .catch((error) => {
        console.error('Token exchange failed:', error);
        if (pendingAuthReject) {
          pendingAuthReject(error);
          pendingAuthReject = null;
          pendingAuthResolve = null;
        }
      });
  }
}

export async function initGoogleAuth(): Promise<void> {
  if (!CLIENT_ID) {
    console.warn('VITE_GOOGLE_CLIENT_ID not configured. Google OAuth disabled.');
    return;
  }

  if (googleInitialized) {
    return;
  }

  await loadGoogleScript();

  await new Promise<void>((resolve) => {
    const checkGoogle = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        setTimeout(checkGoogle, 100);
      }
    };
    checkGoogle();
  });

  codeClient = window.google!.accounts.oauth2.initCodeClient({
    client_id: CLIENT_ID,
    scope: BASE_SCOPES,
    ux_mode: 'popup',
    callback: handleCodeResponse,
    select_account: true,
  });

  googleInitialized = true;
}

export function signIn(): Promise<GoogleUser> {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('Google OAuth not configured. Set VITE_GOOGLE_CLIENT_ID.'));
      return;
    }

    if (!googleInitialized || !codeClient) {
      reject(new Error('Google OAuth not initialized. Call initGoogleAuth() first.'));
      return;
    }

    pendingAuthResolve = resolve;
    pendingAuthReject = reject;

    codeClient.requestCode();
  });
}

export function signOut(): void {
  localStorage.removeItem(STORAGE_KEY);
  
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  if (onAuthChangeCallback) {
    onAuthChangeCallback(null);
  }
}

export function getStoredUser(): GoogleUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const user: GoogleUser = JSON.parse(stored);
    
    if (user.idToken && isTokenExpired(user.idToken)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getStoredUser() !== null;
}

export function onAuthStateChange(callback: (user: GoogleUser | null) => void): () => void {
  onAuthChangeCallback = callback;
  return () => {
    onAuthChangeCallback = null;
  };
}

export function isOAuthConfigured(): boolean {
  return !!CLIENT_ID;
}

export function getIdToken(): string | null {
  const user = getStoredUser();
  return user?.idToken || null;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
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
        oauth2: {
          initCodeClient: (config: CodeClientConfig) => { requestCode: () => void };
          initTokenClient: (config: TokenClientConfig) => { requestAccessToken: () => void };
        };
      };
    };
  }
}
