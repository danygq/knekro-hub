export interface Role {
  id: number;
  name: string;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: number;
  created_at: string;
}

export interface UserRoleWithRole {
  user_id: string;
  role_id: number;
  created_at: string;
  roles?: Role | null;
}
