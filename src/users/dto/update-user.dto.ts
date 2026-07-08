import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    first_name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    last_name?: string;
}