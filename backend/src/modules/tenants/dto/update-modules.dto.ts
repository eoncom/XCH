import { IsObject, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateModulesDto {
  @ApiProperty({
    description: 'Map of module keys to enabled/disabled boolean values',
    example: {
      floor_plans: true,
      racks: true,
      tasks: true,
      contacts: true,
      integrations_netbox: false,
      monitoring: false,
      qr_codes: true,
    },
  })
  @IsObject()
  @IsNotEmpty()
  modules: Record<string, boolean>;
}
