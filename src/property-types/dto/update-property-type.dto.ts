import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdatePropertyTypeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    type_name: string;
}
