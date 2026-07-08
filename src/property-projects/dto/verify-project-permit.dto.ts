import { IsEnum } from 'class-validator';
import { ProjectPermitStatus } from '../../entities/project-permit.entity';

export class VerifyProjectPermitDto {
  @IsEnum(ProjectPermitStatus)
  status: ProjectPermitStatus;
}
