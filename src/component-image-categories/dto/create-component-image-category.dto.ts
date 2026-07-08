import { IsString, IsNotEmpty, MaxLength, IsIn } from 'class-validator';

export class CreateComponentImageCategoryDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(['ROOFING', 'SIDING', 'WINDOW_DOOR', 'WINDOWS', 'DOORS', 'GARAGE_DOORS'], {
        message: 'component_type must be one of: ROOFING, SIDING, WINDOWS, DOORS, GARAGE_DOORS, WINDOW_DOOR',
    })
    component_type: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    display_name: string;
}
