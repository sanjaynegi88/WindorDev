import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePropertyTypeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    type_name: string;
}
