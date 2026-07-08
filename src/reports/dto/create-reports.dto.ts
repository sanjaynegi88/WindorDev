import { IsUUID, IsArray, IsEnum, ArrayNotEmpty } from 'class-validator';

export class CreateReportsDto {
    @IsUUID()
    property_id: string;

    @IsArray()
    @ArrayNotEmpty()
    @IsEnum(['ROOFING', 'SIDING', 'WINDOWS', 'DOORS'], { each: true })
    report_types: string[];
}
