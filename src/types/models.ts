import { UserRole, UserStatus } from "./enums";

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}
