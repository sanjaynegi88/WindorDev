import { IsString, IsEmail, IsOptional, IsArray, IsUrl, ArrayMaxSize, IsNotEmpty, MaxLength, IsUUID, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContractorDirectoryProfileDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    company_name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    contact_name: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    @Matches(/^\d{10}$/, { message: 'phone must be exactly 10 digits' })
    phone: string;

    @IsEmail()
    @IsNotEmpty()
    @MaxLength(255)
    email: string;

    @IsOptional()
    @IsUrl()
    @MaxLength(255)
    website_url?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter((s: string) => s && s.trim() !== '') : [];
            } catch {
                return value.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
            }
        }
        return Array.isArray(value) ? value.filter((s: string) => s && s.trim() !== '') : [];
    })
    @IsArray()
    @IsUUID('4', { each: true, message: 'Each services_provided_ids entry must be a valid UUID' })
    services_provided_ids?: string[];

    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter((id: string) => id && id.trim() !== '') : [];
            } catch {
                return value.split(',').map((s: string) => s.trim()).filter((id: string) => id !== '');
            }
        }
        return Array.isArray(value) ? value.filter((id: string) => id && id.trim() !== '') : [];
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10, { message: 'Maximum 10 cities can be selected' })
    selected_cities: string[];
}

export class UpdateContractorDirectoryProfileDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    company_name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    contact_name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    @Matches(/^\d{10}$/, { message: 'phone must be exactly 10 digits' })
    phone?: string;

    @IsOptional()
    @IsEmail()
    @IsNotEmpty()
    @MaxLength(255)
    email?: string;

    @IsOptional()
    @IsUrl()
    @MaxLength(255)
    website_url?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter((s: string) => s && s.trim() !== '') : [];
            } catch {
                return value.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
            }
        }
        return Array.isArray(value) ? value.filter((s: string) => s && s.trim() !== '') : [];
    })
    @IsArray()
    @IsUUID('4', { each: true, message: 'Each services_provided_ids entry must be a valid UUID' })
    services_provided_ids?: string[];

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed.filter((id: string) => id && id.trim() !== '') : [];
            } catch {
                return value.split(',').map((s: string) => s.trim()).filter((id: string) => id !== '');
            }
        }
        return Array.isArray(value) ? value.filter((id: string) => id && id.trim() !== '') : [];
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10, { message: 'Maximum 10 cities can be selected' })
    selected_cities?: string[];
}
