import { PartialType } from '@nestjs/swagger';
import { CreateContactTypeDto } from './create-contact-type.dto';

export class UpdateContactTypeDto extends PartialType(CreateContactTypeDto) {}
