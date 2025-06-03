export interface Role {
  id: string;
  name: string;
  actions: string[];
  createdAt: string;
}

export interface UserRoles {
  userId: string;
  resourceId: string | null;
  resourceType: "COMMUNITY" | "CHANNEL" | "INSTANCE" | null;
  roles: Role[];
}

export type ResourceType = "COMMUNITY" | "CHANNEL" | "INSTANCE";
