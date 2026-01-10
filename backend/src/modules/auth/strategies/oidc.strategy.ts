import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-openidconnect';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
  constructor(
    config: ConfigService,
    private authService: AuthService,
  ) {
    const enabled = config.get('OIDC_ENABLED') === 'true';

    super({
      issuer: enabled ? config.get('OIDC_ISSUER') : 'http://localhost',
      authorizationURL: enabled ? config.get('OIDC_AUTHORIZATION_URL') || `${config.get('OIDC_ISSUER')}/authorize` : 'http://localhost/authorize',
      tokenURL: enabled ? config.get('OIDC_TOKEN_URL') || `${config.get('OIDC_ISSUER')}/token` : 'http://localhost/token',
      clientID: enabled ? config.get('OIDC_CLIENT_ID') : 'dummy',
      clientSecret: enabled ? config.get('OIDC_CLIENT_SECRET') : 'dummy',
      callbackURL: enabled ? config.get('OIDC_CALLBACK_URL') : 'http://localhost/callback',
      scope: 'openid profile email',
      skipUserProfile: false,
    });
  }

  async validate(issuer: string, profile: any, done: Function) {
    try {
      const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant_default';
      const user = await this.authService.oidcLogin(profile, tenantId);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}
