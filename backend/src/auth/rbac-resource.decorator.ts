import { SetMetadata } from '@nestjs/common';

export enum RbacResourceType {
  COMMUNITY = 'COMMUNITY',
  CHANNEL = 'CHANNEL',
  INSTANCE = 'INSTANCE',
}

export enum ResourceIdSource {
  PARAM = 'param',
  BODY = 'body',
  QUERY = 'query',
}

export interface RbacResourceOptions {
  type: RbacResourceType;
  idKey: string; // e.g., 'communityId'
  source?: ResourceIdSource;
}

export const RBAC_RESOURCE_KEY = 'rbac_resource';

export const RbacResource = (options: RbacResourceOptions) =>
  SetMetadata(RBAC_RESOURCE_KEY, options);
