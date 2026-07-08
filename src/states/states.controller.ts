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
    Req 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatesService } from './states.service';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateStateDto } from './dto/update-state.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';

@Controller('api/states')
export class StatesController {
    constructor(
        private readonly statesService: StatesService,
        private readonly auditService: AuditService
    ) {}

    @Get()
    async findAll(
        @Query('id') id?: string,
        @Query('name') name?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ) {
        if (id) {
            validateUUID(id, 'state id');
            
            const state = await this.statesService.findOne(id);
            return {
                data: state,
                message: 'State retrieved successfully'
            };
        }

        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;

        const { data: states, total } = await this.statesService.findAll({ 
            name, 
            page: pageNum,
            limit: limitNum
        });
        return {
            data: states,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1
            },
            message: `Found ${states.length} states`
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        validateUUID(id, 'state id');
        
        const state = await this.statesService.findOne(id);
        return {
            data: state,
            message: 'State retrieved successfully'
        };
    }

    // Admin only APIs
    @Post()
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() createStateDto: CreateStateDto, @Req() req: any) {
        const state = await this.statesService.create(createStateDto);
        
        // Log admin state creation
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'states',
                recordId: state.id,
                action: 'CREATE',
                newValues: {
                    state_name: state.state_name
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin created new state',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN STATE CREATE AUDIT:', {
                stateId: state.id,
                stateName: state.state_name,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log state creation audit:', auditError);
        }
        
        return {
            data: state,
            message: 'State created successfully',
            createdBy: req.user.id
        };
    }

    @Put(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string, 
        @Body() updateStateDto: UpdateStateDto,
        @Req() req: any
    ) {
        validateUUID(id, 'state id');
        
        const oldState = await this.statesService.findOne(id);
        const state = await this.statesService.update(id, updateStateDto);
        
        // Log admin state update
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'states',
                recordId: id,
                action: 'UPDATE',
                oldValues: {
                    state_name: oldState.state_name
                },
                newValues: {
                    state_name: state.state_name
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin updated state',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN STATE UPDATE AUDIT:', {
                stateId: id,
                stateName: state.state_name,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log state update audit:', auditError);
        }
        
        return {
            data: state,
            message: 'State updated successfully',
            updatedBy: req.user.id
        };
    }

    @Delete(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'state id');
        
        const oldState = await this.statesService.findOne(id);
        await this.statesService.remove(id);
        
        // Log admin state deletion
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'states',
                recordId: id,
                action: 'DELETE',
                oldValues: {
                    state_name: oldState.state_name
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin deleted state',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN STATE DELETE AUDIT:', {
                stateId: id,
                stateName: oldState.state_name,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log state deletion audit:', auditError);
        }
        
        return {
            message: 'State deleted successfully',
            deletedBy: req.user.id,
            deletedId: id
        };
    }
}
