import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';

/**
 * ADR-021 — boot a real NestJS app for intrusion tests.
 *
 * Imports AppModule (full DI tree, real PrismaClient, real guards).
 * Uses the same global pipes / cookie parser as `main.ts` so authn
 * cookies are honored end-to-end.
 *
 * Tests should `beforeAll` create the app, seed the DB via
 * `seedRbac(prisma)`, run scenarios, then `afterAll` close the app
 * and `wipeRbac(prisma)`.
 */
export async function bootTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

export interface AuthenticatedAgent {
  /** Wraps a supertest request that already includes the auth cookie. */
  request: () => request.SuperTest<request.Test>;
  /** Cookie string for explicit `.set('Cookie', cookie)` if needed. */
  cookie: string;
}

/**
 * Login a user via POST /auth/login and return a supertest agent that
 * carries the resulting accessToken cookie. Throws if login fails.
 */
export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<AuthenticatedAgent> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed for ${email}: HTTP ${res.status} — ${JSON.stringify(res.body)}`);
  }
  const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
  if (!accessCookie) {
    throw new Error(`Login for ${email} did not return an accessToken cookie`);
  }
  // Normalize to a single Cookie header value
  const cookie = accessCookie.split(';')[0];

  return {
    cookie,
    request: () => {
      const agent = request.agent(app.getHttpServer());
      // supertest agents persist cookies between calls automatically
      agent.set('Cookie', cookie);
      return agent;
    },
  };
}

/**
 * Convenience helper for one-shot intrusion attempts.
 *
 * Example :
 *   const r = await intrusionRequest(app, agent, {
 *     method: 'GET',
 *     path: '/api/contacts/' + idB,
 *     delegationId: 'A',
 *   });
 *   expect(r.status).toBe(404);
 */
export async function intrusionRequest(
  app: INestApplication,
  agent: AuthenticatedAgent,
  opts: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    delegationId?: string | null;
    body?: any;
  },
): Promise<{ status: number; body: any }> {
  const httpServer = app.getHttpServer();
  let req: request.Test;
  switch (opts.method) {
    case 'GET':    req = request(httpServer).get(opts.path); break;
    case 'POST':   req = request(httpServer).post(opts.path); break;
    case 'PUT':    req = request(httpServer).put(opts.path); break;
    case 'PATCH':  req = request(httpServer).patch(opts.path); break;
    case 'DELETE': req = request(httpServer).delete(opts.path); break;
  }
  req.set('Cookie', agent.cookie);
  if (opts.delegationId !== undefined && opts.delegationId !== null) {
    req.set('X-Delegation-Id', opts.delegationId);
  }
  if (opts.body !== undefined) {
    req.send(opts.body);
  }
  const res = await req;
  return { status: res.status, body: res.body };
}
