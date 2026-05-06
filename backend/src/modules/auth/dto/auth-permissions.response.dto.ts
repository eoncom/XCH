import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * Compact delegation reference embedded in the `delegations[]` array.
 */
export class MyPermissionsDelegationRefResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty()
  @Expose()
  code!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupLabel?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  groupColor?: string | null;
}

/**
 * UserDelegation row exposed inside the `delegations[]` array of the
 * my-permissions composite. Mirrors the Prisma `UserDelegation` shape
 * with the included compact delegation reference.
 */
export class MyPermissionsDelegationItemResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty()
  @Expose()
  delegationId!: string;

  @ApiProperty({ description: 'Right level: MANAGE | WRITE | READ' })
  @Expose()
  right!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Origin of grant: manual | sso' })
  @Expose()
  grantedBy?: string | null;

  @ApiProperty({ type: () => MyPermissionsDelegationRefResponseDto })
  @Expose()
  @Type(() => MyPermissionsDelegationRefResponseDto)
  delegation!: MyPermissionsDelegationRefResponseDto;
}

/**
 * Response for `GET /auth/my-permissions`. Composite shape derived from
 * the user's super-admin flag + their UserDelegation rows + the resolved
 * accessible-site list (null = full tenant access).
 *
 * Cas C — the `delegations[]` field is a typed array of items; the rest
 * are scalars and an `accessibleSiteIds` array (null sentinel = full).
 */
export class MyPermissionsResponseDto {
  @ApiProperty()
  @Expose()
  isSuperAdmin!: boolean;

  @ApiProperty()
  @Expose()
  hasDelegation!: boolean;

  @ApiProperty({ description: 'True iff the caller can see every site in the tenant (super-admin or null accessibleSiteIds)' })
  @Expose()
  allSitesAccess!: boolean;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    description: 'List of accessible site IDs. `null` means full tenant access (no restriction).',
  })
  @Expose()
  accessibleSiteIds!: string[] | null;

  @ApiProperty({ type: () => [MyPermissionsDelegationItemResponseDto] })
  @Expose()
  @Type(() => MyPermissionsDelegationItemResponseDto)
  delegations!: MyPermissionsDelegationItemResponseDto[];
}
