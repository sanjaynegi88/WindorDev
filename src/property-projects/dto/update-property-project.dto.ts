import { IsString, IsOptional, IsEnum, IsDateString, IsInt, IsUUID, MaxLength, IsBoolean } from 'class-validator';
import { ProjectType, ProjectStatus } from '../../entities/property-project.entity';

export class UpdatePropertyProjectDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    project_name?: string;

    @IsOptional()
    @IsString()
    @IsEnum(ProjectType, { message: `project_type must be one of: ${Object.values(ProjectType).join(', ')}` })
    project_type?: string;

    @IsOptional()
    @IsDateString()
    date_of_install?: string;

    @IsOptional()
    @IsBoolean()
    need_permit?: boolean;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    permit?: string;

    @IsOptional()
    @IsUUID()
    governing_city_id?: string;

    @IsOptional()
    @IsString()
    project_status?: string;

    @IsOptional()
    @IsUUID()
    contractor_id?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    visible_status?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    other?: string;
}