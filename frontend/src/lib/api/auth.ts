import { apiClient } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const authApi = {
  setup2FA: () =>
    apiClient.post<{ secret: string; qrCodeDataUrl: string }>('/api/auth/2fa/setup', {}),

  verifySetup: (token: string) =>
    apiClient.post<{ enabled: boolean; backupCodes: string[] }>('/api/auth/2fa/verify-setup', { token }),

  verify2FA: async (code: string, tempToken: string) => {
    const res = await fetch(`${API_URL}/api/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, tempToken }),
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Code TOTP invalide');
    }
    return res.json();
  },

  verifyBackup: async (code: string, tempToken: string) => {
    const res = await fetch(`${API_URL}/api/auth/2fa/backup-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, tempToken }),
      credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Code de récupération invalide');
    }
    return res.json();
  },

  disable2FA: (password: string) =>
    apiClient.post<{ disabled: boolean }>('/api/auth/2fa/disable', { password }),

  /** Admin: disable 2FA for any user */
  adminDisable2FA: (userId: string) =>
    apiClient.delete<{ disabled: boolean }>(`/api/auth/2fa/user/${userId}`),

  /** Invite a user (admin/manager) */
  invite: (data: { email: string; name: string; role?: string }) =>
    apiClient.post('/api/auth/invite', data),

  /** Accept invitation and set password (public) */
  acceptInvite: async (token: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/accept-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erreur lors de l\'activation');
    }
    return res.json();
  },

  /** Request password reset (public) */
  forgotPassword: async (email: string) => {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  /** Reset password with token (public) */
  resetPassword: async (token: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Erreur lors de la réinitialisation');
    }
    return res.json();
  },
};
