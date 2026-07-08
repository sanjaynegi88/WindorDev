import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReactivateUsersDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one user ID is required' })
    @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
    userIds: string[];
}
