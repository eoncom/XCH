import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum DelegationRightDto {
  MANAGE = 'MANAGE',
  WRITE = 'WRITE',
  READ = 'READ',
}

export class CreateUserDelegationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  delegationId: string;

  @IsEnum(DelegationRightDto)
  right: DelegationRightDto;
}

export class UpdateUserDelegationRightDto {
  @IsEnum(DelegationRightDto)
  right: DelegationRightDto;
}

export class BulkSetUserDelegationsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  delegations: { delegationId: string; right: DelegationRightDto }[];
}
