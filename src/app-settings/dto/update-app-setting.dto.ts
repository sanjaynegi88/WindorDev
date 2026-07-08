import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateAppSettingDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    value: string;
}
