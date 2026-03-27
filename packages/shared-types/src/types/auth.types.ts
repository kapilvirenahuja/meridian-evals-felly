export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IJwtPayload {
  sub: string;
  email: string;
  realm_access: {
    roles: string[];
  };
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export interface IRegistrationResult {
  userId: string;
  email: string;
  verificationToken: string;
}
