import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class DoorsDto {
    @IsOptional()
    @IsUUID()
    property_id?: string;

    @IsUUID()
    project_id: string;

    @IsOptional()
    @IsString()
    other_brand?: string;

    @IsString()
    @IsOptional()
    manufacturer?: string;

    @IsString()
    @IsOptional()
    where_install?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsDateString()
    @IsOptional()
    install_date?: string;

    @IsString()
    @IsOptional()
    supplier?: string;

    @IsString()
    @IsOptional()
    installer?: string;

    @IsUUID(4, { message: 'brand_id must be a valid UUID' })
    @IsOptional()
    brand_id?: string;

    @IsString()
    @IsOptional()
    production_line?: string;

    @IsString()
    @IsOptional()
    order_number?: string;

    @IsString()
    @IsOptional()
    door_code?: string;

    @IsString()
    @IsOptional()
    material?: string;
}
