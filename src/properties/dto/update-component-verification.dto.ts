import { IsBoolean } from 'class-validator';

export class UpdateComponentVerificationDto {
    @IsBoolean({ message: 'installer_verified must be a boolean value (true or false)' })
    installer_verified: boolean;
}