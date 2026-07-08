import { Controller, Post, Body, Param, UseGuards, Req, Get, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VerifyProjectPermitDto } from './dto/verify-project-permit.dto';
import { SaveOwnerProjectDetailsDto } from './dto/save-owner-project-details.dto';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { OwnerProjectsService } from './owner-projects.service';


@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
@Controller('api/owner-project')

export class OwnerProjectsController {
    constructor(private readonly ownerProjectsService: OwnerProjectsService) {}

    @Post(':propertyId')
    @Roles(UserRole.PROPERTY_OWNER, UserRole.ADMIN)
    async saveDetails(
        @Param('propertyId') propertyId: string,
        @Body() dto: SaveOwnerProjectDetailsDto,
        @Req() req: any
    ) {
        validateUUID(propertyId, 'property id');
        const userId = req.user?.id;
        if (!userId) {
            throw new UnauthorizedException('User not authenticated');
        }
        const data = await this.ownerProjectsService.saveDetails(propertyId, dto, userId);
        return { data, message: 'Owner project specifications saved successfully' };
    }

    @Post(':projectId/verify')
    @Roles(UserRole.CITY_INSPECTOR, UserRole.ADMIN)
    async verifyProjectByProjectId(
        @Param('projectId') projectId: string,
        @Body() dto: VerifyProjectPermitDto,
        @Req() req: any
    ) {
        const data = await this.ownerProjectsService.verifyProjectByProjectId(projectId, dto, req.user.id, req.user.role);
        return { data, message: 'Project verification updated' };
    }

    @Get('types')
    
    async getOwnerProjectTypes() {
        const homeownerPredefined = [
            'NEW_CABINETS',
            'NEW_APPLIANCES',
            'NEW_FURNACE',
            'NEW_AC',
            'ADDED_ROOM',
            'NEW_YARD_WORK',
            'OTHER'
        ];
        // Return in the same shape as /api/reports/types
        return {
            data: {
                report_types: homeownerPredefined.map(name => ({ name }))
            }
        };
    }
}
