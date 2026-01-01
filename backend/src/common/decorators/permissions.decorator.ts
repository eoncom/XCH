import { SetMetadata } from '@nestjs/common';

export const Resource = (resource: string) => SetMetadata('resource', resource);
export const Action = (action: string) => SetMetadata('action', action);
