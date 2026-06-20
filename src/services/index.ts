import type { AuthUser, Camera, Location, StreamSession } from '../types';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'funeraria_auth_token';
const USER_KEY = 'funeraria_auth_user';
const CONFIG_TOKEN_KEY = 'viewer_config_auth_token';
const CONFIG_USER_KEY = 'viewer_config_auth_user';

interface ApiList<T> {
  data: T[];
}

interface ApiItem<T> {
  data: T;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function storeSession(response: LoginResponse) {
  sessionStorage.setItem(TOKEN_KEY, response.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
}

export function hasStoredSession() {
  return Boolean(getToken());
}

export function getStoredAuthUser(): AuthUser | null {
  const stored = sessionStorage.getItem(USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function resolveApiAssetUrl(assetUrl: string) {
  if (/^https?:\/\//i.test(assetUrl)) return assetUrl;
  return `${API_URL}${assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`}`;
}

async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('funeraria-auth-expired'));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => undefined);
    throw new Error(error?.message ?? 'Nao foi possivel comunicar com o sistema.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await api<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password, surface: 'viewer' },
  });
  storeSession(response);
  return response.user;
}

export async function loginWithTemporaryAccess(token: string): Promise<AuthUser> {
  const response = await api<LoginResponse>('/api/auth/temporary-access', {
    method: 'POST',
    body: { token },
  });
  storeSession(response);
  return response.user;
}

export async function refreshSession(): Promise<AuthUser> {
  const response = await api<LoginResponse>('/api/auth/refresh', { method: 'POST' });
  storeSession(response);
  return response.user;
}

export async function changePassword(newPassword: string, confirmPassword: string): Promise<AuthUser> {
  const response = await api<{ user: AuthUser }>('/api/auth/change-password', {
    method: 'POST',
    body: { newPassword, confirmPassword },
  });
  sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
  return response.user;
}

export async function getCameras(): Promise<Camera[]> {
  const response = await api<ApiList<Camera>>('/api/cameras');
  return response.data;
}

export async function getLocations(): Promise<Location[]> {
  const response = await api<ApiList<Location>>('/api/locations');
  return response.data;
}

function getConfigToken() {
  return sessionStorage.getItem(CONFIG_TOKEN_KEY);
}

function storeConfigSession(response: LoginResponse) {
  sessionStorage.setItem(CONFIG_TOKEN_KEY, response.token);
  sessionStorage.setItem(CONFIG_USER_KEY, JSON.stringify(response.user));
}

export function hasStoredConfigSession() {
  return Boolean(getConfigToken());
}

export function getStoredConfigUser(): AuthUser | null {
  const stored = sessionStorage.getItem(CONFIG_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    clearConfigSession();
    return null;
  }
}

export function clearConfigSession() {
  sessionStorage.removeItem(CONFIG_TOKEN_KEY);
  sessionStorage.removeItem(CONFIG_USER_KEY);
}

async function configApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getConfigToken();
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');

  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    clearConfigSession();
    window.dispatchEvent(new Event('viewer-config-auth-expired'));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => undefined);
    throw new Error(error?.message ?? 'Nao foi possivel comunicar com o sistema.');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function loginConfig(username: string, password: string): Promise<AuthUser> {
  const response = await configApi<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { username, password, surface: 'admin' },
  });
  if (response.user.role !== 'SUPER_ADMIN') {
    throw new Error('Somente SUPER_ADMIN pode acessar esta configuracao.');
  }
  if (response.user.mustChangePassword) {
    throw new Error('Troque sua senha obrigatoria no painel principal antes de continuar.');
  }
  storeConfigSession(response);
  return response.user;
}

export async function refreshConfigSession(): Promise<AuthUser> {
  const response = await configApi<LoginResponse>('/api/auth/refresh', { method: 'POST' });
  if (response.user.role !== 'SUPER_ADMIN') {
    clearConfigSession();
    throw new Error('Permissao insuficiente.');
  }
  storeConfigSession(response);
  return response.user;
}

export async function getConfigLocations(): Promise<Location[]> {
  const response = await configApi<ApiList<Location>>('/api/locations');
  return response.data;
}

export async function updateLocationViewerBrand(locationId: string, name: string | null): Promise<Location> {
  const response = await configApi<ApiItem<Location>>(`/api/locations/${locationId}/viewer-brand`, {
    method: 'PATCH',
    body: { name },
  });
  return response.data;
}

export async function updateLocationViewerLogo(locationId: string, dataUrl: string): Promise<Location> {
  const response = await configApi<ApiItem<Location>>(`/api/locations/${locationId}/viewer-logo`, {
    method: 'POST',
    body: { dataUrl },
  });
  return response.data;
}

export async function removeLocationViewerLogo(locationId: string): Promise<Location> {
  const response = await configApi<ApiItem<Location>>(`/api/locations/${locationId}/viewer-logo`, {
    method: 'DELETE',
  });
  return response.data;
}

export async function createStreamSession(
  cameraId: string,
  options: { viewSessionId?: string; reconnect?: boolean } = {}
): Promise<StreamSession> {
  const response = await api<ApiItem<StreamSession>>(`/api/cameras/${cameraId}/stream-session`, {
    method: 'POST',
    body: options,
  });
  return response.data;
}

export async function heartbeatStreamSession(cameraId: string, viewSessionId: string): Promise<void> {
  await api(`/api/cameras/${cameraId}/stream-session/${viewSessionId}/heartbeat`, {
    method: 'POST',
  });
}

export async function endStreamSession(
  cameraId: string,
  viewSessionId: string,
  keepalive = false
): Promise<void> {
  await api(`/api/cameras/${cameraId}/stream-session/${viewSessionId}/end`, {
    method: 'POST',
    body: { reason: 'player_closed' },
    keepalive,
  });
}
