import { IsString, IsArray, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateCityDto {
    @IsString()
    name: string;

    @IsString()
    state_id: string;

    @IsArray()
    @IsString({ each: true })
    zip_codes: string[];

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