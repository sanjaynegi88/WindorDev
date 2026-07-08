import { IsString, IsOptional, MaxLength, IsUUID, IsArray, IsDateString, ValidateIf, Allow } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    first_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    last_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    display_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    company_name?: string;

    @IsOptional()
    @IsString()
    profile_image_url?: string;

    @IsOptional()
    @IsUUID('4')
    city_id?: string;

    @IsOptional()
    @IsUUID('4')
    state_id?: string;

    @IsOptional()
    @IsString()
    companyAddress?: string;

    @IsOptional()
    @IsString()
    websiteUrl?: string;

    @IsOptional()
    @IsString()
    mobilePhone?: string;

    @IsOptional()
    @IsString()
    companyPhone?: string;

    @IsOptional()
    @IsString()
    propertyAddress?: string;

    @IsOptional()
    @ValidateIf(o => o.ownerDateStart !== '')
    @IsDateString()
    ownerDateStart?: string;

    @IsOptional()
    @ValidateIf(o => o.ownerDateEnd !== '')
    @IsDateString()
    ownerDateEnd?: string;

    @IsOptional()
    @IsString()
    serviceTypes?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    cityOfficial?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    cityAddress?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    cityPhone?: string;
}

// Interface for processed data passed to service
export interface ProcessedUpdateProfileDto {
    first_name?: string;
    last_name?: string;
    display_name?: string;
    company_name?: string;
    profile_image_url?: string;
    city_id?: string;
    state_id?: string;
    companyAddress?: string;
    websiteUrl?: string;
    mobilePhone?: string;
    companyPhone?: string;
    propertyAddress?: string;
    ownerDateStart?: string;
    ownerDateEnd?: string;
    serviceTypes?: string;
    title?: string;
    cityOfficial?: string;
    cityAddress?: string;
    cityPhone?: string;
}

