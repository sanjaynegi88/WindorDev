import { IsString, IsOptional } from 'class-validator';

export class UpdateStateDto {
    @IsString()
    @IsOptional()
    state_name?: string;
}
