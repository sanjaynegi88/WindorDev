import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsBoolean, IsUUID, MaxLength, IsInt } from 'class-validator';
import { ProjectStatus } from '../../entities/property-project.entity';

export class CreatePropertyProjectDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    project_name: string;

    @IsString()
    @IsNotEmpty()
    project_type: string; // Dynamic role-based validation in the service layer

    @IsOptional()
    @IsString()
    @MaxLength(255)
    other?: string;

    @IsOptional()
    @IsString()
    visible_status?: string; // Validated dynamically in the service layer ('public' or 'private')

    @IsOptional()
    @IsDateString()
    date_of_install?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    permit?: string;

    @IsOptional()
    @IsBoolean()
    need_permit?: boolean;

    @IsOptional()
    @IsUUID()
    governing_city_id?: string;

    @IsOptional()
    @IsEnum(ProjectStatus, { message: 'project_status must be either DRAFT or COMPLETE' })
    project_status?: ProjectStatus;

    @IsOptional()
    @IsUUID()
    contractor_id?: string;

    @IsOptional()
    @IsString()
    notes?: string;
}