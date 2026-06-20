export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email?: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'END_USER';
  mustChangePassword?: boolean;
  capabilities?: {
    audio: boolean;
    recording: boolean;
  };
  expiresAt?: string;
}

export interface Camera {
  id: string;
  equipmentId: string;
  name: string;
  originalName?: string;
  channel: number;
  status: 'online' | 'offline';
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  viewerBrandName?: string;
  viewerLogoUrl?: string;
  active: boolean;
  equipmentIds: string[];
}

export interface StreamSession {
  hlsUrl: string;
  playerUrl: string;
  expiresAt: string;
  viewSessionId: string;
  watermarkCode: string;
}
