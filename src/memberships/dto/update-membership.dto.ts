import { IsString, IsNumber, IsOptional, Min, IsObject } from 'class-validator';

export class UpdateMembershipDto {
    @IsString()
    @IsOptional()
    membership_name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    price_usd?: number;

    @IsNumber()
    @Min(1)
    @IsOptional()
    renewal_days?: number;

    @IsObject()
    @IsOptional()
    features?: any;
}