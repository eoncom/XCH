import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { HashService } from './hash.service';

/**
 * Global crypto module — exposes CryptoService (AES-256-GCM secrets
 * at-rest) and HashService (SHA-256 token lookups). @Global so the
 * 4 cibles ADR-019 + auth tokens can inject without each business
 * module re-importing.
 */
@Global()
@Module({
  providers: [CryptoService, HashService],
  exports: [CryptoService, HashService],
})
export class CryptoModule {}
