export interface CreateCommunity {
  name: string;
  description: string | null;
  avatar: string | null;
  banner: string | null;
}

export interface CreateCommunityFormData {
  name: string;
  description: string;
  avatar: File | null;
  banner: File | null;
}
