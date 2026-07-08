import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class WindowsDoorsDto {
    @IsOptional()
    @IsUUID()
    property_id?: string;

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
}
