import { PartialType } from '@nestjs/swagger';
import { CreateRackDto } from './create-rack.dto';

export class UpdateRackDto extends PartialType(CreateRackDto) {}
