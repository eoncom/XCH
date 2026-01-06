declare module 'passport-openidconnect' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface StrategyOptions {
    issuer?: string;
    authorizationURL?: string;
    tokenURL?: string;
    userInfoURL?: string;
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string | string[];
    skipUserProfile?: boolean;
    passReqToCallback?: boolean;
  }

  export interface Profile {
    id: string;
    displayName?: string;
    name?: {
      familyName?: string;
      givenName?: string;
      middleName?: string;
    };
    emails?: Array<{
      value: string;
      verified?: boolean;
    }>;
    photos?: Array<{
      value: string;
    }>;
    provider: string;
    _raw: string;
    _json: any;
  }

  export type VerifyCallback = (err?: Error | null, user?: any, info?: any) => void;

  export type VerifyFunction = (
    issuer: string,
    profile: Profile,
    done: VerifyCallback,
  ) => void;

  export type VerifyFunctionWithRequest = (
    req: any,
    issuer: string,
    profile: Profile,
    done: VerifyCallback,
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction | VerifyFunctionWithRequest);
    name: string;
    authenticate(req: any, options?: any): void;
  }
}
