import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsObject, IsBoolean, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';

// Custom validator to ensure features is an object and not an array
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
                    return `${args.property} must be an object`;
                }
            }
        });
    };
}

export class CreatePlanPricesDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    monthlyAmount: number;

    @IsNumber()
    @Min(0)
    yearlyAmount: number;

    @IsObject()
    @IsNotArray({ message: 'features must be an object' })
    features: Record<string, any>;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}