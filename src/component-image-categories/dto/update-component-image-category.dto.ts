import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateComponentImageCategoryDto {
    @IsString()
    @IsOptional()
    @MaxLength(100)
    display_name?: string;

    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
