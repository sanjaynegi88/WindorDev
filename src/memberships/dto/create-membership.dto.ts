import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsObject } from 'class-validator';

export class CreateMembershipDto {
    @IsString()
    @IsNotEmpty()
    membership_name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    price_usd: number;

    @IsNumber()
    @Min(1)
    renewal_days: number;

    @IsObject()
    @IsOptional()
    features?: any;
}