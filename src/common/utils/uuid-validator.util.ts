import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function validateUUID(id: string, paramName: string = 'id'): void {
  if (!isUUID(id)) {
    throw new BadRequestException(`Invalid UUID: ${id}. Please provide a valid UUID for ${paramName}.`);
  }
}