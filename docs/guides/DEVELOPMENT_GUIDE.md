# XCH - Guide de Développement Complet

**Date** : 2025-12-31
**Objectif** : Implémenter les 7 modules core de l'application

> ⚠️ **Document historique — partiellement obsolète (v1.4.x).**
>
> Ce guide date du démarrage projet (décembre 2025, pré-MVP). Il décrit l'architecture initiale — dont un module `casbin/` avec `@Resource/@Action` et 4 rôles `ADMIN/MANAGER/TECHNICIEN/VIEWER` — qui a été entièrement remplacé.
>
> Pour l'autorisation actuelle, voir :
> - [AUTH_MODEL.md](../architecture/AUTH_MODEL.md) — modèle delegation-first v2 (Casbin retiré v1.3)
> - [ADR-009 delegation-first](../decisions/adr-009-delegation-first-model.md)
>
> La structure `backend/src/modules/` a également évolué : on compte aujourd'hui 27 modules NestJS (cf. [PROJECT_STATUS.md](../status/PROJECT_STATUS.md)), pas 7.

---

## 📁 STRUCTURE CRÉÉE

```
backend/
├── src/
│   ├── main.ts                    ✅ Bootstrap app
│   ├── app.module.ts               ✅ Module racine
│   ├── config/
│   │   └── database.module.ts      ✅ Prisma config
│   ├── modules/
│   │   ├── auth/                   🔄 En cours
│   │   │   ├── auth.module.ts      ✅
│   │   │   ├── auth.service.ts     ⏳ À créer
│   │   │   ├── auth.controller.ts  ⏳ À créer
│   │   │   ├── strategies/
│   │   │   │   ├── local.strategy.ts   ⏳
│   │   │   │   ├── jwt.strategy.ts     ⏳
│   │   │   │   └── oidc.strategy.ts    ⏳
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts        ⏳
│   │   │   │   └── register.dto.ts     ⏳
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts   ⏳
│   │   │       └── local-auth.guard.ts ⏳
│   │   ├── rbac/                   ⏳ Casbin RBAC
│   │   ├── tenants/                ⏳
│   │   ├── users/                  ⏳
│   │   ├── sites/                  ⏳ Module 2
│   │   ├── assets/                 ⏳ Module 3
│   │   ├── racks/                  ⏳ Module 4
│   │   ├── tasks/                  ⏳ Module 5
│   │   ├── floor-plans/            ⏳ Module 6
│   │   └── integrations/           ⏳ Module 7
│   ├── common/
│   │   ├── guards/                 ⏳ Guards communs
│   │   ├── decorators/             ⏳ Decorators
│   │   ├── interceptors/           ⏳ Interceptors
│   │   └── filters/                ⏳ Exception filters
│   └── casbin/
│       ├── model.conf              ⏳ Casbin model
│       └── policy.csv              ⏳ Initial policies
├── prisma/
│   ├── schema.prisma               ✅ Complet
│   ├── seed.ts                     ⏳ À créer
│   └── migrations/                 (généré automatiquement)
├── package.json                    ✅
├── tsconfig.json                   ✅
└── nest-cli.json                   ✅
```

---

## 🔑 MODULE 1 : AUTH (Priorité absolue)

### Fichiers AUTH à créer

Vu le nombre de fichiers nécessaires (15+ pour auth complet), voici l'ordre optimal de création et templates de code.

### 1.1 Auth Service (`src/modules/auth/auth.service.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Inject } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    @Inject('PRISMA_CLIENT') private prisma: PrismaClient,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // Validate user (local strategy)
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.active) {
      throw new UnauthorizedException('Account disabled');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  // Login
  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    };
  }

  // Register (création user local)
  async register(data: { email: string; password: string; name: string; tenantId: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hashedPassword,
        name: data.name,
        tenantId: data.tenantId,
        role: 'VIEWER', // Default role
        authProvider: 'local',
      },
      include: { tenant: true },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  // OIDC login (Just-In-Time provisioning)
  async oidcLogin(profile: any, tenantId: string) {
    let user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        externalId: profile.id, // OIDC 'sub' claim
      },
      include: { tenant: true },
    });

    if (!user) {
      // JIT provisioning
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.displayName || profile.name,
          externalId: profile.id,
          authProvider: 'oidc',
          tenantId,
          role: 'VIEWER', // TODO: Map from OIDC groups
        },
        include: { tenant: true },
      });
    }

    return this.login(user);
  }

  // Refresh token
  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { tenant: true },
      });

      if (!user || !user.active) {
        throw new UnauthorizedException();
      }

      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
```

### 1.2 Local Strategy (`src/modules/auth/strategies/local.strategy.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### 1.3 JWT Strategy (`src/modules/auth/strategies/jwt.strategy.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };
  }
}
```

### 1.4 OIDC Strategy (`src/modules/auth/strategies/oidc.strategy.ts`)

```typescript
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
    super({
      issuer: config.get('OIDC_ISSUER'),
      clientID: config.get('OIDC_CLIENT_ID'),
      clientSecret: config.get('OIDC_CLIENT_SECRET'),
      callbackURL: config.get('OIDC_CALLBACK_URL'),
      scope: 'openid profile email',
    });
  }

  async validate(issuer: string, profile: any, done: Function) {
    try {
      const tenantId = process.env.DEFAULT_TENANT_ID; // TODO: Extract from OIDC claims
      const user = await this.authService.oidcLogin(profile, tenantId);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}
```

### 1.5 Auth Controller (`src/modules/auth/auth.controller.ts`)

```typescript
import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email/password' })
  async login(@Request() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Request() req) {
    return req.user;
  }

  // OIDC endpoints
  @Get('oidc')
  @ApiOperation({ summary: 'Initiate OIDC login' })
  oidcLogin() {
    // Redirect to OIDC provider
  }

  @Get('oidc/callback')
  @ApiOperation({ summary: 'OIDC callback' })
  oidcCallback() {
    // Handle OIDC callback
  }
}
```

### 1.6 DTOs

**login.dto.ts:**
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
```

**register.dto.ts:**
```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  tenantId: string;
}
```

### 1.7 Guards

**jwt-auth.guard.ts:**
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**local-auth.guard.ts:**
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

---

## 🛡️ MODULE RBAC (Casbin)

### Fichiers RBAC à créer

### 2.1 Casbin Model (`backend/casbin/model.conf`)

```conf
[request_definition]
r = sub, obj, act, tenant

[policy_definition]
p = sub, obj, act, tenant

[role_definition]
g = _, _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub, r.tenant) && r.obj == p.obj && r.act == p.act && (r.tenant == p.tenant || p.tenant == "*")
```

### 2.2 Initial Policies (`backend/casbin/policy.csv`)

```csv
# ADMIN - Full access
p, admin, sites, create, *
p, admin, sites, read, *
p, admin, sites, update, *
p, admin, sites, delete, *
p, admin, assets, create, *
p, admin, assets, read, *
p, admin, assets, update, *
p, admin, assets, delete, *
p, admin, racks, create, *
p, admin, racks, read, *
p, admin, racks, update, *
p, admin, racks, delete, *
p, admin, tasks, create, *
p, admin, tasks, read, *
p, admin, tasks, update, *
p, admin, tasks, delete, *
p, admin, users, create, *
p, admin, users, read, *
p, admin, users, update, *
p, admin, users, delete, *

# MANAGER
p, manager, sites, read, *
p, manager, assets, read, *
p, manager, racks, read, *
p, manager, tasks, create, *
p, manager, tasks, read, *
p, manager, tasks, update, *

# TECHNICIEN
p, technicien, sites, create, *
p, technicien, sites, read, *
p, technicien, sites, update, *
p, technicien, assets, create, *
p, technicien, assets, read, *
p, technicien, assets, update, *
p, technicien, assets, delete, *
p, technicien, racks, create, *
p, technicien, racks, read, *
p, technicien, racks, update, *
p, technicien, tasks, create, *
p, technicien, tasks, read, *
p, technicien, tasks, update, *

# VIEWER
p, viewer, sites, read, *
p, viewer, assets, read, *
p, viewer, racks, read, *
p, viewer, tasks, read, *
```

### 2.3 RBAC Module (`src/modules/rbac/rbac.module.ts`)

```typescript
import { Module, Global } from '@nestjs/common';
import { newEnforcer } from 'casbin';
import { TypeORMAdapter } from '@casbin/typeorm-adapter';
import path from 'path';

@Global()
@Module({
  providers: [
    {
      provide: 'CASBIN_ENFORCER',
      useFactory: async () => {
        const adapter = await TypeORMAdapter.newAdapter({
          type: 'postgres',
          url: process.env.DATABASE_URL,
        });

        const modelPath = path.join(__dirname, '../../../casbin/model.conf');
        const enforcer = await newEnforcer(modelPath, adapter);

        await enforcer.loadPolicy();
        return enforcer;
      },
    },
  ],
  exports: ['CASBIN_ENFORCER'],
})
export class RbacModule {}
```

### 2.4 Casbin Guard (`src/common/guards/casbin.guard.ts`)

```typescript
import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    @Inject('CASBIN_ENFORCER') private enforcer: Enforcer,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const resource = this.reflector.get<string>('resource', context.getHandler());
    const action = this.reflector.get<string>('action', context.getHandler());

    if (!resource || !action) {
      return true; // No permission defined
    }

    const allowed = await this.enforcer.enforce(
      user.role,
      resource,
      action,
      user.tenantId,
    );

    return allowed;
  }
}
```

### 2.5 Permission Decorators (`src/common/decorators/permissions.decorator.ts`)

```typescript
import { SetMetadata } from '@nestjs/common';

export const Resource = (resource: string) => SetMetadata('resource', resource);
export const Action = (action: string) => SetMetadata('action', action);
```

---

## 🌱 SEED INITIAL (`backend/prisma/seed.ts`)

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'idf' },
    update: {},
    create: {
      name: 'Délégation Île-de-France',
      subdomain: 'idf',
      status: 'ACTIVE',
      primaryColor: '#0070f3',
    },
  });
  console.log(`✅ Tenant created: ${tenant.name}`);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@xch.local' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@xch.local',
      passwordHash,
      name: 'Administrateur',
      role: 'ADMIN',
      active: true,
      authProvider: 'local',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create test users
  const users = [
    { email: 'manager@xch.local', name: 'Manager Test', role: 'MANAGER' },
    { email: 'tech@xch.local', name: 'Technicien Test', role: 'TECHNICIEN' },
    { email: 'viewer@xch.local', name: 'Viewer Test', role: 'VIEWER' },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        tenantId: tenant.id,
        email: userData.email,
        passwordHash,
        name: userData.name,
        role: userData.role as any,
        active: true,
        authProvider: 'local',
      },
    });
    console.log(`✅ User created: ${userData.email}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## 🚀 COMMANDES D'INSTALLATION

```bash
# 1. Installer dépendances backend
cd backend
npm install

# 2. Démarrer infrastructure Docker
cd ..
docker-compose up -d

# 3. Générer client Prisma
cd backend
npm run prisma:generate

# 4. Créer migration initiale
npm run prisma:migrate -- --name init

# 5. Seed database
npm run prisma:seed

# 6. Démarrer backend en dev
npm run start:dev

# Tester auth:
# POST http://localhost:3001/api/auth/login
# {"email": "admin@xch.local", "password": "admin"}
```

---

## ✅ ÉTAT APRÈS MODULE AUTH + RBAC

**Fonctionnel** :
- ✅ Login local (email/password)
- ✅ JWT tokens (access + refresh)
- ✅ OIDC architecture prête (config required)
- ✅ RBAC Casbin (4 rôles, policies DB)
- ✅ Guards (JWT, Casbin)
- ✅ Tenant + 4 users seeded

**À tester** :
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@xch.local","password":"admin"}'

# Get profile (with token)
curl -X GET http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📝 PROCHAINES ÉTAPES

Une fois AUTH + RBAC testés et fonctionnels :

1. **Créer modules Users + Tenants** (CRUD basique)
2. **Module Sites** (CRUD + PostGIS queries)
3. **Module Assets** (CRUD + QR codes)
4. **Module Racks** (montage équipements)
5. **Module Tasks** (checklist)
6. **Module FloorPlans** (upload + pins)
7. **Module Integrations** (NetBox + monitoring)

Chaque module suit le pattern :
- `module.ts` (imports)
- `service.ts` (logique métier + Prisma)
- `controller.ts` (routes + guards)
- `dto/` (validation)

---

**Continue le développement après avoir testé AUTH !**
