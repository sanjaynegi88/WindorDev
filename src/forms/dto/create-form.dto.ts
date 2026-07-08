import { IsString, IsOptional, IsDateString, IsArray, MaxLength, IsUUID, Matches, ValidateIf } from 'class-validator';

export class CreateFormDto {
    @IsOptional()
    @IsString()
    @MaxLength(255)
    companyAddress?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    websiteUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    licenseNumber?: string;

    @IsOptional()
    @Matches(/^\d{10}$/, { message: 'mobilePhone must be exactly 10 digits' })
    mobilePhone?: string;

    @IsOptional()
    @Matches(/^\d{10}$/, { message: 'companyPhone must be exactly 10 digits' })
    companyPhone?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
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
    @IsArray()
    @IsUUID('4', { each: true, message: 'Each serviceType must be a valid UUID' })
    serviceTypes?: string[];

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
    @Matches(/^\d{10}$/, { message: 'cityPhone must be exactly 10 digits' })
    cityPhone?: string;
}
