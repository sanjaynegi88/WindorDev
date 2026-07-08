import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateServiceProvidedDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    service_name: string;
}
