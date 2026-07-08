import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePropertyDto {
    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsOptional()
    address2?: string;

    @IsString()
    @IsOptional()
    property_name?: string;

    @IsUUID()
    @IsOptional()
    property_type_id?: string;


    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => value ? parseFloat(value) : null)
    square_foot?: number;

    @IsUUID()
    @IsNotEmpty()
    city_id: string;

    @IsString()
    @IsNotEmpty()
    zip: string;

    @IsNumber()
    @IsOptional()
    @Min(-90)
    @Max(90)
    @Transform(({ value }) => value ? parseFloat(value) : null)
    latitude?: number;

    @IsNumber()
    @IsOptional()
    @Min(-180)
    @Max(180)
    @Transform(({ value }) => value ? parseFloat(value) : null)
    longitude?: number;

    @IsUUID()
    @IsOptional()
    @Transform(({ value }) => value === '' ? null : value)
    property_owner_id?: string;

    @IsUUID()
    @IsOptional()
    @Transform(({ value }) => value === '' ? null : value)
    contractor_id?: string;
}
