export interface Community {
  id: string;
  name: string;
  avatar?: string | null;
  banner?: string | null;
  description?: string | null;
  createdAt: Date;
}
