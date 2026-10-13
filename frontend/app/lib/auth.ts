export function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('username');
  window.dispatchEvent(new Event('auth-change'));
}

export function readSession(): { token: string; username: string; expiresAt: number } | null {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    return { token, username: localStorage.getItem('username') ?? '', expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}
