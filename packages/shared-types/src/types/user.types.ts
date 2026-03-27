import { UserRole, UserStatus, ExpertiseCategory } from '../enums';

export interface IUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMenteeProfile {
  id: string;
  userId: string;
  interests: ExpertiseCategory[];
  bio: string | null;
  completeness: number;
  createdAt: Date;
  updatedAt: Date;
}
