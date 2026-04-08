import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum UserRoleDto {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  TECHNICIEN = 'TECHNICIEN',
  VIEWER = 'VIEWER',
}

export class CreateUserDelegationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  delegationId: string;

  @IsEnum(UserRoleDto)
  role: UserRoleDto;
}

export class UpdateUserDelegationRoleDto {
  @IsEnum(UserRoleDto)
  role: UserRoleDto;
}

export class BulkSetUserDelegationsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  delegations: { delegationId: string; role: UserRoleDto }[];
}
