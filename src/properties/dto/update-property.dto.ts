import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePropertyDto {
    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    address2?: string;

    @IsString()
    @IsOptional()
    property_name?: string;

    @IsUUID()
    @IsOptional()
    @Transform(({ value }) => value === '' ? null : value)
    property_type_id?: string | null;


    @IsNumber()
    @IsOptional()
    square_foot?: number;

    @IsUUID()
    @IsOptional()
    city_id?: string;

    @IsString()
    @IsOptional()
    zip?: string;

    @IsNumber()
    @IsOptional()
    latitude?: number;

    @IsNumber()
    @IsOptional()
    longitude?: number;

    @IsUUID()
    @IsOptional()
    @Transform(({ value }) => value === '' ? null : value)
    property_owner_id?: string;

    @IsBoolean()
    @IsOptional()
    verified_status?: boolean;

    @IsUUID(4, { message: 'brand_id must be a valid UUID' })
    @IsOptional()
    @Transform(({ value }) => value === '' ? null : value)
    brand_id?: string;  // Brand ID from brands table for property components
}