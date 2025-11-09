import { UserEntity } from '@/user/dto/user-response.dto';
import { Request as ExpressRequest } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: UserEntity;
    }
  }
}

export type AuthenticatedRequest = ExpressRequest & { user: UserEntity };
