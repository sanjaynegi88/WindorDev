import { IsString, IsOptional, IsDateString, IsUUID, MaxLength } from 'class-validator';

export class SaveOwnerProjectDetailsDto {
    @IsUUID()
    project_id: string;

    @IsOptional()
    @IsUUID()
    brand_id?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    other_brand?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    installer?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    supplier?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsDateString()
    install_date?: string;
}
