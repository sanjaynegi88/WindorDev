import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { VerifyProjectPermitDto } from './dto/verify-project-permit.dto';
import { OwnerProjectsService } from './owner-projects.service';

@Controller('api/permit')
@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
export class PermitController {
    constructor(private readonly ownerProjectsService: OwnerProjectsService) {}

    @Post(':permitId/verify')
    @Roles(UserRole.CITY_INSPECTOR, UserRole.ADMIN)
    async verifyPermit(
        @Param('permitId') permitId: string,
        @Body() dto: VerifyProjectPermitDto,
        @Req() req: any
    ) {
        const data = await this.ownerProjectsService.verifyPermit(permitId, dto, req.user.id, req.user.role);
        return { data, message: 'Project permit verification updated' };
    }
}
