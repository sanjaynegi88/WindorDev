import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';

// 1. UPPERCASE VALIDATOR
@ValidatorConstraint({ name: 'isPasswordUpper', async: false })
export class IsPasswordUpperConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        return typeof value === 'string' && /[A-Z]/.test(value);
    }
    defaultMessage() {
        return 'Password must contain at least one uppercase letter';
    }
}

export function IsPasswordUpper(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPasswordUpperConstraint,
        });
    };
}

// 2. LOWERCASE VALIDATOR
@ValidatorConstraint({ name: 'isPasswordLower', async: false })
export class IsPasswordLowerConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        return typeof value === 'string' && /[a-z]/.test(value);
    }
    defaultMessage() {
        return 'Password must contain at least one lowercase letter';
    }
}

export function IsPasswordLower(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPasswordLowerConstraint,
        });
    };
}

// 3. NUMBER VALIDATOR
@ValidatorConstraint({ name: 'isPasswordNumber', async: false })
export class IsPasswordNumberConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        return typeof value === 'string' && /[0-9]/.test(value);
    }
    defaultMessage() {
        return 'Password must contain at least one number';
    }
}

export function IsPasswordNumber(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPasswordNumberConstraint,
        });
    };
}

// 4. SPECIAL CHARACTER VALIDATOR
@ValidatorConstraint({ name: 'isPasswordSpecial', async: false })
export class IsPasswordSpecialConstraint implements ValidatorConstraintInterface {
    validate(value: string) {
        return typeof value === 'string' && /[@#$%^&+=!]/.test(value);
    }
    defaultMessage() {
        return 'Password must contain at least one special character';
    }
}

export function IsPasswordSpecial(validationOptions?: ValidationOptions) {
    return (object: object, propertyName: string) => {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsPasswordSpecialConstraint,
        });
    };
}
