export interface IPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp?: string;
  path?: string;
}

export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_LOGGED_OUT = 'USER_LOGGED_OUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  MENTOR_APPLICATION_SUBMITTED = 'MENTOR_APPLICATION_SUBMITTED',
  MENTOR_APPLICATION_APPROVED = 'MENTOR_APPLICATION_APPROVED',
  MENTOR_APPLICATION_REJECTED = 'MENTOR_APPLICATION_REJECTED',
}
