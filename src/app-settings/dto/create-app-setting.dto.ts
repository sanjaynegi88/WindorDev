import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateAppSettingDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    key: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    value: string;
}
