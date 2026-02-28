export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  permissions?: Record<string, boolean> | string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

