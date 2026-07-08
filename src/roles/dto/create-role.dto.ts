import { IsString, IsNotEmpty, MaxLength, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z_]+$/ , {
    message: 'role_name must be uppercase letters and underscores only',
  })
  role_name: string;

    @IsBoolean()
    @IsOptional()
    is_public?: boolean;
}
