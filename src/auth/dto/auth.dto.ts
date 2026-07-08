import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsUUID, MaxLength, Matches, IsDateString, IsArray, ValidateIf } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { IsPasswordUpper, IsPasswordLower, IsPasswordNumber, IsPasswordSpecial } from '../decorators/password.decorator';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsPasswordUpper()
    @IsPasswordLower()
    @IsPasswordNumber()
    @IsPasswordSpecial()
    password: string;

    @IsString()
    @IsNotEmpty()
    first_name: string;

    @IsString()
    @IsNotEmpty()
    last_name: string;

    @IsUUID('4', { message: 'role_id must be a valid UUID from the roles table' })
    @IsNotEmpty()
    role_id: string;
}

export class CompleteFormDto {
    @IsOptional()
    @IsUUID('4', { message: 'state_id must be a valid UUID' })
    state_id?: string;

    @IsOptional()
    @IsUUID(4, { message: 'city_id must be a valid UUID' })
    city_id?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    zip?: string;

    @IsOptional()
    @IsString()
    company_name?: string;

    // ── Onboarding form fields (all optional at DTO level; role-based required validation in FormsService) ──

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

// Legacy DTO for backwards compatibility
export class RegisterDtoLegacy {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsPasswordUpper()
    @IsPasswordLower()
    @IsPasswordNumber()
    @IsPasswordSpecial()
    password: string;

    @IsString()
    @IsNotEmpty()
    first_name: string;

    @IsString()
    @IsNotEmpty()
    last_name: string;

    @IsUUID('4', { message: 'role_id must be a valid UUID from the roles table' })
    @IsNotEmpty()
    role_id: string;

    @IsOptional()
    @IsUUID('4', { message: 'state_id must be a valid UUID' })
    state_id?: string;

    @IsOptional()
    @IsUUID(4, { message: 'city_id must be a valid UUID' })
    city_id?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    zip?: string;

    @IsOptional()
    @IsString()
    company_name?: string;

    // ── Onboarding form fields (all optional at DTO level; role-based required validation in FormsService) ──

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

export class VerifyRegistrationDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'OTP must be 6 digits' })
    @MaxLength(6, { message: 'OTP must be 6 digits' })
    otp: string;
}

export class ResendOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class AdminCreateUserDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsPasswordUpper()
    @IsPasswordLower()
    @IsPasswordNumber()
    @IsPasswordSpecial()
    password: string;

    @IsString()
    @IsNotEmpty()
    first_name: string;

    @IsString()
    @IsNotEmpty()
    last_name: string;

    @IsUUID('4', { message: 'role_id must be a valid UUID from the roles table' })
    @IsNotEmpty()
    role_id: string;

    @IsOptional()
    @IsUUID('4', { message: 'state_id must be a valid UUID' })
    state_id?: string;

    @IsOptional()
    @IsUUID(4, { message: 'city_id must be a valid UUID' })
    city_id?: string;

    @IsOptional()
    @IsString()
    @MaxLength(20)
    zip?: string;

    @IsOptional()
    @IsString()
    company_name?: string;

    // ── Onboarding form fields (all optional at DTO level; role-based required validation in FormsService) ──

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

    // Role-based validation method
    validateRoleRequiredFields(roleName: string): void {
        const missing: string[] = [];

        if (roleName === 'CONTRACTOR' || roleName === 'MANUFACTURER') {
            if (!this.companyAddress) missing.push('companyAddress');
            if (!this.websiteUrl) missing.push('websiteUrl');
            if (!this.mobilePhone) missing.push('mobilePhone');
            if (!this.companyPhone) missing.push('companyPhone');
            if (!this.serviceTypes || this.serviceTypes.length === 0) missing.push('serviceTypes');
        } else if (roleName === 'PROPERTY_OWNER' || roleName === 'REALTOR') {
            if (!this.propertyAddress) missing.push('propertyAddress');
            if (!this.ownerDateStart) missing.push('ownerDateStart');
            if (!this.mobilePhone) missing.push('mobilePhone');
        } else if (roleName === 'CITY_INSPECTOR') {
            if (!this.city_id) missing.push('city_id');
            if (!this.cityOfficial) missing.push('cityOfficial');
            if (!this.cityAddress) missing.push('cityAddress');
            if (!this.cityPhone) missing.push('cityPhone');
            if (!this.title) missing.push('title');
        } else if (roleName === 'INSURANCE_COMPANY') {
            if (!this.company_name?.trim()) missing.push('company_name');
            if (!this.companyAddress) missing.push('companyAddress');
            if (!this.websiteUrl) missing.push('websiteUrl');
            if (!this.mobilePhone) missing.push('mobilePhone');
            if (!this.companyPhone) missing.push('companyPhone');
            if (!this.title) missing.push('title');
        }

        if (missing.length > 0) {
            throw new Error(`The following fields are required for ${roleName}: ${missing.join(', ')}`);
        }
    }
}

export class CreateStaffDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    password: string;

    @IsString()
    @IsNotEmpty()
    first_name: string;

    @IsString()
    @IsNotEmpty()
    last_name: string;
}

export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    refresh_token: string;
}

export class GoogleLoginDto {
    @IsString()
    @IsNotEmpty()
    idToken: string;

    // Optional OTP for verification step (same endpoint)
    @IsOptional()
    @IsString()
    otp?: string;
}

export class AssignRoleDto {
    @IsUUID('4', { message: 'role_id must be a valid UUID from the roles table' })
    @IsNotEmpty()
    role_id: string;

    @IsOptional()
    @IsUUID(4, { message: 'city_id must be a valid UUID' })
    city_id?: string;

    @IsOptional()
    @IsString()
    company_name?: string;

    // ── Onboarding form fields (all optional at DTO level; role-based required validation in FormsService) ──

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

export class AppleLoginDto {
    @IsString()
    @IsNotEmpty()
    idToken: string;
}
