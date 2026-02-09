import type { AntigravityCredentials, CredentialsStatus, CredentialsUploadResponse } from '../types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://proxy.hoainho.info';

export function validateCredentialsJson(json: unknown): { valid: boolean; error?: string; credentials?: AntigravityCredentials } {
  if (!json || typeof json !== 'object') {
    return { valid: false, error: 'Invalid JSON format' };
  }

  const obj = json as Record<string, unknown>;

  const requiredFields = ['access_token', 'refresh_token', 'email', 'project_id', 'type'];
  for (const field of requiredFields) {
    if (!obj[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (obj.type !== 'antigravity') {
    return { valid: false, error: `Invalid credentials type: ${obj.type}. Expected: antigravity` };
  }

  if (typeof obj.access_token !== 'string' || !obj.access_token.startsWith('ya29.')) {
    return { valid: false, error: 'Invalid access_token format' };
  }

  if (typeof obj.email !== 'string' || !obj.email.includes('@')) {
    return { valid: false, error: 'Invalid email format' };
  }

  return {
    valid: true,
    credentials: obj as unknown as AntigravityCredentials,
  };
}

export async function uploadCredentials(
  credentials: AntigravityCredentials,
  googleIdToken: string
): Promise<CredentialsUploadResponse> {
  try {
    const response = await fetch(`${PROXY_URL}/v0/credentials/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${googleIdToken}`,
      },
      body: JSON.stringify({
        credentials,
        type: 'antigravity',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || 'upload_failed',
        message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Failed to connect to server',
    };
  }
}

export async function checkCredentialsStatus(googleIdToken: string): Promise<CredentialsStatus> {
  try {
    const response = await fetch(`${PROXY_URL}/v0/credentials/status`, {
      headers: {
        'Authorization': `Bearer ${googleIdToken}`,
      },
    });

    if (!response.ok) {
      return { hasCredentials: false };
    }

    return await response.json();
  } catch {
    return { hasCredentials: false };
  }
}

export async function deleteCredentials(googleIdToken: string): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${PROXY_URL}/v0/credentials/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${googleIdToken}`,
      },
    });

    if (!response.ok) {
      return { success: false, message: 'Failed to delete credentials' };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export function parseCredentialsFile(content: string): { valid: boolean; error?: string; credentials?: AntigravityCredentials } {
  try {
    const json = JSON.parse(content);
    return validateCredentialsJson(json);
  } catch {
    return { valid: false, error: 'Invalid JSON syntax' };
  }
}

export function formatExpiryDate(expired: string): string {
  try {
    const date = new Date(expired);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs < 0) {
      return 'Expired';
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `Expires in ${diffDays}d ${diffHours}h`;
    }
    if (diffHours > 0) {
      return `Expires in ${diffHours}h`;
    }
    return 'Expires soon';
  } catch {
    return expired;
  }
}
