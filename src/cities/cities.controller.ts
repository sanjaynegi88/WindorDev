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
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';

@Controller('api/cities')
export class CitiesController {
    constructor(
        private readonly citiesService: CitiesService,
        private readonly auditService: AuditService
    ) {}

    // Public GET APIs (no token required)
    @Get()
    async findAll(
        @Query('id') id?: string,
        @Query('name') name?: string,
        @Query('state_id') state_id?: string,
        @Query('is_active') is_active?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ) {
        if (id) {
            validateUUID(id, 'city id');
            
            // If both id and state_id are provided, validate city belongs to that state
            if (state_id) {
                validateUUID(state_id, 'state id');
                const city = await this.citiesService.findOneByStateId(id, state_id);
                return {
                    data: city,
                    message: 'City retrieved successfully'
                };
            } else {
                const city = await this.citiesService.findOne(id);
                return {
                    data: city,
                    message: 'City retrieved successfully'
                };
            }
        }

        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;

        const filters = {
            name,
            state_id: state_id ? (validateUUID(state_id, 'state id'), state_id) : undefined,
            is_active: is_active ? is_active === 'true' : undefined,
            page: pageNum,
            limit: limitNum
        };

        const { data: cities, total } = await this.citiesService.findAll(filters);
        
        return {
            data: cities,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1
            },
            message: `Found ${cities.length} cities`
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        validateUUID(id, 'city id');
        
        const city = await this.citiesService.findOne(id);
        return {
            data: city,
            message: 'City retrieved successfully'
        };
    }

    // Admin-only APIs (token required)
    @Post()
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() createCityDto: CreateCityDto, @Req() req: any) {
        const city = await this.citiesService.create(createCityDto);
        
        // Log admin city creation
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'cities',
                recordId: city.id,
                action: 'CREATE',
                newValues: {
                    name: city.name,
                    state_id: city.state_id,
                    is_active: city.is_active
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin created new city',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN CITY CREATE AUDIT:', {
                cityId: city.id,
                cityName: city.name,
                stateId: city.state_id,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log city creation audit:', auditError);
        }
        
        return {
            data: city,
            message: 'City created successfully',
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };
    }

    @Put(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string,
        @Body() updateCityDto: UpdateCityDto,
        @Req() req: any
    ) {
        validateUUID(id, 'city id');
        
        const oldCity = await this.citiesService.findOne(id);
        const city = await this.citiesService.update(id, updateCityDto);
        
        // Log admin city update
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'cities',
                recordId: id,
                action: 'UPDATE',
                oldValues: {
                    name: oldCity.name,
                    state_id: oldCity.state_id,
                    is_active: oldCity.is_active
                },
                newValues: {
                    name: city.name,
                    state_id: city.state_id,
                    is_active: city.is_active
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin updated city',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN CITY UPDATE AUDIT:', {
                cityId: id,
                cityName: city.name,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log city update audit:', auditError);
        }
        
        return {
            data: city,
            message: 'City updated successfully',
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString()
        };
    }

    @Delete(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'city id');
        
        const oldCity = await this.citiesService.findOne(id);
        await this.citiesService.remove(id);
        
        // Log admin city deletion
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'cities',
                recordId: id,
                action: 'DELETE',
                oldValues: {
                    name: oldCity.name,
                    state_id: oldCity.state_id,
                    is_active: oldCity.is_active
                },
                changedByUserId: req.user.id,
                changeReason: 'Admin deleted city',
                ipAddress,
                userAgent
            });
            
            console.log('ADMIN CITY DELETE AUDIT:', {
                cityId: id,
                cityName: oldCity.name,
                adminId: req.user.id,
                timestamp: new Date().toISOString(),
                ipAddress
            });
        } catch (auditError) {
            console.error('Failed to log city deletion audit:', auditError);
        }
        
        return {
            message: 'City deleted successfully',
            deletedBy: req.user.id,
            deletedAt: new Date().toISOString(),
            deletedCityId: id
        };
    }
}