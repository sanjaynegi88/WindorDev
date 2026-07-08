import { IsUUID, IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class RoofingDto {
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

    @IsString()
    @IsOptional()
    type?: string;

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
    brand_id?: string;  // Brand ID from brands table

    @IsString()
    @IsOptional()
    style?: string;

    @IsString()
    @IsOptional()
    color?: string;

    @IsString()
    @IsOptional()
    material?: string;

    @IsBoolean()
    @IsOptional()
    impact_resistant?: boolean;

    @IsString()
    @IsOptional()
    class_rating?: string;
}
