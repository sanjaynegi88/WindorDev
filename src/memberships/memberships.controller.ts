import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query,
    UseGuards, 
    Req, 
    HttpStatus,
    ForbiddenException 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@Controller('api/memberships')
@UseGuards(AuthGuard('firebase-jwt'))
export class MembershipsController {
    constructor(private readonly membershipsService: MembershipsService) {}

    private throwAdminOnlyError(userRole: string, endpoint: string) {
        throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Access Denied - Administrator Privileges Required',
            error: 'INSUFFICIENT_PERMISSIONS',
            details: {
                requiredRole: 'ADMIN',
                currentRole: userRole,
                endpoint: endpoint,
                reason: 'This endpoint is restricted to administrators only',
                solution: 'Contact your system administrator for access'
            }
        });
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() createMembershipDto: CreateMembershipDto, @Req() req: any) {
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'POST /api/memberships');
        }

        try {
            const membership = await this.membershipsService.create(createMembershipDto, req.user.role);
            return {
                data: membership,
                message: 'Membership created successfully',
                createdBy: req.user.id,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'POST /api/memberships');
            }
            throw error;
        }
    }

    @Get()
    async findAll(@Query('id') id?: string) {
        // If ID is provided as query parameter, return specific membership
        if (id) {
            const membership = await this.membershipsService.findOne(id);
            return {
                data: membership,
                message: 'Membership retrieved successfully'
            };
        }

        // Otherwise return all memberships
        const memberships = await this.membershipsService.findAll();
        return {
            data: memberships,
            message: `Found ${memberships.length} memberships`,
            total: memberships.length
        };
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string, 
        @Body() updateMembershipDto: UpdateMembershipDto, 
        @Req() req: any
    ) {
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/memberships/:id');
        }

        try {
            const membership = await this.membershipsService.update(id, updateMembershipDto, req.user.role);
            return {
                data: membership,
                message: 'Membership updated successfully',
                updatedBy: req.user.id,
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'PUT /api/memberships/:id');
            }
            throw error;
        }
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'DELETE /api/memberships/:id');
        }

        try {
            await this.membershipsService.remove(id, req.user.role);
            return {
                message: 'Membership deleted successfully',
                deletedBy: req.user.id,
                deletedAt: new Date().toISOString(),
                deletedMembershipId: id
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'DELETE /api/memberships/:id');
            }
            throw error;
        }
    }
}