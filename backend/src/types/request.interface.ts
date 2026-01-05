import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;        // User ID (alias for userId)
  userId: string;    // User ID (full property name)
  tenantId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user: AuthenticatedUser;
}
