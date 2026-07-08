import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsObject, IsBoolean, ValidationArguments, registerDecorator, ValidationOptions, IsEnum, IsInt } from 'class-validator';
import { UserRole } from '../../entities/user.entity';
import { Level } from '../../entities/membership-plan.entity';

function IsNotArray(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isNotArray',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    return typeof value === 'object' && value !== null && !Array.isArray(value);
                },
                defaultMessage(args: ValidationArguments) {
                    return `${args.property} must be a JSON object, not an array`;
                }
            }
        });
    };
}

export class CreateMembershipPlanDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    @IsOptional()
    monthlyAmount?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    yearlyAmount?: number;

    @IsEnum(UserRole)
    @IsOptional()
    targetRole?: UserRole;

    @IsEnum(Level)
    @IsOptional()
    level?: Level;

    @IsInt()
    @Min(0)
    @IsOptional()
    maxUsers?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    maxReports?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    maxCities?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    maxProperties?: number;

    @IsInt()
    @Min(0)
    @IsOptional()
    maxProjects?: number;

    @IsBoolean()
    @IsOptional()
    isUnlimitedProperties?: boolean;

    @IsBoolean()
    @IsOptional()
    isUnlimitedProjects?: boolean;

    @IsBoolean()
    @IsOptional()
    isUnlimitedAccess?: boolean;

    @IsObject()
    @IsNotArray({ message: 'Features must be a JSON object, not an array.' })
    features: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}
