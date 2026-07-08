import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class GarageDoorsDto {
    @IsOptional()
    @IsUUID()
    property_id?: string;

    @IsUUID()
    project_id: string;

    @IsUUID(4, { message: 'brand_id must be a valid UUID' })
    @IsOptional()
    brand_id?: string;

    @IsOptional()
    @IsString()
    other_brand?: string;

    @IsOptional()
    @IsString()
    brand?: string;

    @IsOptional()
    @IsString()
    manufacturer?: string;

    @IsOptional()
    @IsString()
    where_install?: string;

    @IsOptional()
    @IsString()
    order_number?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsDateString()
    @IsOptional()
    install_date?: string;

    @IsOptional()
    @IsString()
    supplier?: string;

    @IsOptional()
    @IsString()
    installer?: string;

    @IsOptional()
    @IsString()
    windcode?: string;

    @IsOptional()
    @IsString()
    permit_status?: string;

    @IsOptional()
    @IsString()
    material?: string;
}
