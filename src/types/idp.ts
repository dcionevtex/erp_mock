export type IdpUser = {
  email: string;
  name: string;
  password: string;
};

export type IdpConfig = {
  clientId: string;
  clientSecret: string;
  users: IdpUser[];
};

export type IdpCode = {
  email: string;
  name: string;
  userId: string;
  state: string;
  redirectUri: string;
  createdAt: number;
};

export type IdpToken = {
  email: string;
  name: string;
  userId: string;
  createdAt: number;
};

export type IdpCallEndpoint = 'authorize' | 'token' | 'userinfo';

export type IdpCallLogEntry = {
  id: string;
  timestamp: string;
  endpoint: IdpCallEndpoint;
  method: string;
  account: string;
  email?: string;
  success: boolean;
  statusCode: number;
  details?: string;
};
