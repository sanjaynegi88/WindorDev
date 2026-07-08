import { IsOptional, IsString } from 'class-validator';

export class CreateProjectPermitDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
