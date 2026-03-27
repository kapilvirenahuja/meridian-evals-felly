export interface JwtPayload {
  sub: string;
  email: string;
  realm_access: {
    roles: string[];
  };
  iss: string;
  aud: string;
  exp?: number;
  iat?: number;
}
