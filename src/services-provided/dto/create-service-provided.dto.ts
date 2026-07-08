import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateServiceProvidedDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    service_name: string;
}
