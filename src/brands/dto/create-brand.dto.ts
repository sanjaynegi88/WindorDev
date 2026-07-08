import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { BrandCategory } from '../../entities/brand.entity';

export class CreateBrandDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    category: string;

    @IsString()
    @IsOptional()
    description?: string;
}