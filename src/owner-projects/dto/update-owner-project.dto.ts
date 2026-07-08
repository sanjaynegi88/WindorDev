import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';

export class UpdateOwnerProjectDto {
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @IsOptional()
  @IsString()
  other_brand?: string;

  @IsOptional()
  @IsString()
  installer?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  install_date?: string; // ISO date string
}
