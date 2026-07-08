import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateAutoRenewalDto {
    @IsBoolean()
    @IsNotEmpty()
    autoRenewalEnabled: boolean;
}