import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BrandCategory } from '../../entities/brand.entity';

export class UpdateBrandDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsString()
    @IsOptional()
    description?: string;
}