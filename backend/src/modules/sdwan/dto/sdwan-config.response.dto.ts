import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact firewall asset reference exposed inside SD-WAN config responses.
 * Mirrors the `select` declared in CONFIG_INCLUDE within sdwan.service.ts.
 */
export class SdwanFirewallAssetRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name?: string | null;

  @ApiProperty({ description: 'Asset type (FIREWALL, ROUTER…)' })
  @Expose()
  type!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  serialNumber?: string | null;

  @ApiProperty({ description: 'Asset status (IN_SERVICE, …)' })
  @Expose()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  ip?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  mac?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  hostname?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  vlan?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  port?: string | null;
}

/**
 * SdwanFirewall row (link entity) exposed inside SdwanConfig.firewalls[].
 */
export class SdwanFirewallResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  sdwanConfigId!: string;

  @ApiProperty()
  @Expose()
  assetId!: string;

  @ApiProperty({ description: 'active | passive | …' })
  @Expose()
  role!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: () => SdwanFirewallAssetRefResponseDto })
  @Expose()
  @Type(() => SdwanFirewallAssetRefResponseDto)
  asset!: SdwanFirewallAssetRefResponseDto;
}

/**
 * SdwanConfig entity exposed by GET / PUT / POST attach / DELETE detach.
 * Cas C — Prisma entity + firewalls[] with embedded asset refs.
 */
export class SdwanConfigResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  siteId!: string;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'SD-WAN provider name (Cisco vManage, FortiManager, …)' })
  @Expose()
  provider?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  notes?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  @ApiProperty({ type: () => [SdwanFirewallResponseDto] })
  @Expose()
  @Type(() => SdwanFirewallResponseDto)
  firewalls!: SdwanFirewallResponseDto[];
}

/**
 * Response for `DELETE /sdwan/:siteId` — service returns `{ deleted: true }`.
 */
export class SdwanDeletedResultResponseDto {
  @ApiProperty()
  @Expose()
  deleted!: boolean;
}
