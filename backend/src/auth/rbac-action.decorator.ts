import { SetMetadata } from '@nestjs/common';
import { RbacActions } from '@prisma/client';

export const RBAC_ACTION_KEY = 'rbac-action';
export const RequiredActions = (...actions: RbacActions[]) =>
  SetMetadata(RBAC_ACTION_KEY, actions);
