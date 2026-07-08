import { IsString, IsArray, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class UpdateCityDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    state_id?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    zip_codes?: string[];

    @IsOptional()
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}