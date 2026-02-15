import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment text' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;

  @ApiProperty({ required: false, description: 'System-generated comment flag' })
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
