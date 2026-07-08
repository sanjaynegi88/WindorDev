import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CountsService } from './counts.service';

@Controller('api/counts')
@UseGuards(AuthGuard('firebase-jwt'))
export class CountsController {
    constructor(private readonly countsService: CountsService) {}

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CITY_INSPECTOR, UserRole.INSURANCE_COMPANY, UserRole.PROPERTY_OWNER, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async getCounts(@Req() req: any) {
        const counts = await this.countsService.getCounts(req.user.id, req.user.role, req.user.sub_account);
        
        return {
            data: counts,
            message: 'Counts retrieved successfully',
            requestedBy: req.user.id,
            requestedAt: new Date().toISOString()
        };
    }
}