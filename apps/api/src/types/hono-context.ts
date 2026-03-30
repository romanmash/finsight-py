export type UserRole = 'admin' | 'analyst' | 'viewer';

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  telegramHandle: string | null;
  active: boolean;
}

export interface AppVariables {
  requestId: string;
  requestStartMs: number;
  principal: AuthenticatedPrincipal | null;
}

export interface AppEnv {
  Variables: AppVariables;
}
