import { SetMetadata } from '@nestjs/common';

export enum RbacResourceType {
  COMMUNITY = 'COMMUNITY',
  CHANNEL = 'CHANNEL',
  INSTANCE = 'INSTANCE',
  DM_GROUP = 'DM_GROUP',
  MESSAGE = 'MESSAGE',
  ALIAS_GROUP = 'ALIAS_GROUP',
}

export enum ResourceIdSource {
  BODY = 'body',
  QUERY = 'query',
  PARAM = 'param',
  PAYLOAD = 'payload',
  TEXT_PAYLOAD = 'text_payload',
}

export interface RbacResourceOptions {
  type: RbacResourceType;
  idKey?: string; // e.g., 'communityId'
  source?: ResourceIdSource;
}

export const RBAC_RESOURCE_KEY = 'rbac_resource';

export const RbacResource = (options: RbacResourceOptions) =>
  SetMetadata(RBAC_RESOURCE_KEY, options);
