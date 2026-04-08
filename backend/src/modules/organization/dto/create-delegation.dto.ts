import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDelegationDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, description: 'Visual grouping label (R8)' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  groupLabel?: string;

  @ApiProperty({ required: false, description: 'Visual grouping color hex (R8)' })
  @IsString()
  @IsOptional()
  @MaxLength(7)
  groupColor?: string;
}
