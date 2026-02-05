import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  order: number;
}

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
  @ValidateNested({ each: true })
  @Type(() => ChecklistItem)
  checklist: ChecklistItem[];
}
