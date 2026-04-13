import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DelegationRight } from '@prisma/client';

export class InviteUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: DelegationRight, default: DelegationRight.READ })
  @IsOptional()
  @IsEnum(DelegationRight)
  right?: DelegationRight;
}
