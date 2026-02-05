import { IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateChecklistDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        text: { type: 'string' },
        checked: { type: 'boolean' },
        order: { type: 'number' },
      },
    },
    example: [
      { id: '1', text: 'Verify network connectivity', checked: true, order: 1 },
      { id: '2', text: 'Test equipment', checked: false, order: 2 },
    ],
  })
  @IsArray()
  checklist: Record<string, any>[];
}
