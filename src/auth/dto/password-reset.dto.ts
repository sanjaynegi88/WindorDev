import { IsEmail, IsNotEmpty, IsString, MinLength, IsUUID } from 'class-validator';

export class ForgotPasswordDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class VerifyOtpDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    otp: string;
}

export class ResetPasswordDto {
    @IsUUID()
    @IsNotEmpty()
    reset_token: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword: string;
}

export class ChangePasswordDto {
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    newPassword: string;
}
