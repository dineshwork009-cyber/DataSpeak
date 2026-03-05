export interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    string;
  user:         UserProfile;
}

export interface UserProfile {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  fullName:   string;
  tenantId:   string;
  tenantName: string;
  role:       TenantRole;
}

export type TenantRole = 'Owner' | 'Admin' | 'Analyst' | 'Viewer';

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface RegisterRequest {
  tenantName: string;
  email:      string;
  password:   string;
  firstName:  string;
  lastName:   string;
}
