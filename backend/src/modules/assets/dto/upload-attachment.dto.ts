import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AttachmentCategory {
  SPEC = 'spec',
  INVOICE = 'invoice',
  PHOTO = 'photo',
  REPORT = 'report',
  MANUAL = 'manual',
  OTHER = 'other',
}

export class UploadAttachmentDto {
  @ApiProperty({ required: false, description: 'Description of the attachment' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    enum: AttachmentCategory,
    description: 'Category of the attachment',
  })
  @IsEnum(AttachmentCategory)
  @IsOptional()
  category?: AttachmentCategory;
}
