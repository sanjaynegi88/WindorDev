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
    ForbiddenException,
    BadRequestException,
    Logger
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Brand, BrandCategory } from '../entities/brand.entity';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';

@Controller('api/brands')
@UseGuards(AuthGuard('firebase-jwt'))
export class BrandsController {
    constructor(
        private readonly brandsService: BrandsService,
        private readonly auditService: AuditService
    ) {}

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
    async create(@Body() createBrandDto: CreateBrandDto, @Req() req: any) {
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'POST /api/brands');
        }

        try {
            const brand = await this.brandsService.create(createBrandDto, req.user.role);
            
            // Log admin brand creation
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'brands',
                    recordId: brand.id,
                    action: 'CREATE',
                    newValues: {
                        name: brand.name,
                        category: brand.category,
                        created_by_admin: req.user.id
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin created new brand',
                    ipAddress,
                    userAgent
                });
                
                console.log('🏷️ ADMIN BRAND CREATE AUDIT:', {
                    brandId: brand.id,
                    brandName: brand.name,
                    category: brand.category,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log brand creation audit:', auditError);
            }
            
            return {
                data: brand,
                message: 'Brand created successfully',
                createdBy: req.user.id,
                createdAt: new Date().toISOString()
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'POST /api/brands');
            }
            throw error;
        }
    }

    @Get()
    async findAll(
        @Query('id') id?: string, 
        @Query('category') category?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Req() req?: any
    ) {
        // If ID is provided as query parameter, return specific brand
        if (id) {
            validateUUID(id, 'brand id');
            
            const brand = await this.brandsService.findOne(id);
            return {
                data: brand,
                message: 'Brand retrieved successfully'
            };
        }

        let resolvedCategory: string | undefined;
        if (category) {
            const trimmed = category.trim().toUpperCase();
            const validCategories = Object.values(BrandCategory) as string[];
            if (!validCategories.includes(trimmed)) {

            }
            resolvedCategory = trimmed;
        }

        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;

        // Return all brands (optionally filtered by category)
        const { data: brands, total } = await this.brandsService.findAll(resolvedCategory, pageNum, limitNum);
        
        return {
            data: brands,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1
            },
            message: category 
                ? `Found ${brands.length} brands for category: ${category}` 
                : `Found ${brands.length} brands`
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        validateUUID(id, 'brand id');
        
        const brand = await this.brandsService.findOne(id);
        return {
            data: brand,
            message: 'Brand retrieved successfully'
        };
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string, 
        @Body() updateBrandDto: UpdateBrandDto, 
        @Req() req: any
    ) {
        validateUUID(id, 'brand id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/brands/:id');
        }

        try {
            const oldBrand = await this.brandsService.findOne(id);
            const brand = await this.brandsService.update(id, updateBrandDto, req.user.role);
            
            // Log admin brand update
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'brands',
                    recordId: id,
                    action: 'UPDATE',
                    oldValues: {
                        name: oldBrand.name,
                        category: oldBrand.category
                    },
                    newValues: {
                        name: brand.name,
                        category: brand.category,
                        updated_by_admin: req.user.id
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin updated brand',
                    ipAddress,
                    userAgent
                });
                
                console.log('🏷️ ADMIN BRAND UPDATE AUDIT:', {
                    brandId: id,
                    brandName: brand.name,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log brand update audit:', auditError);
            }
            
            return {
                data: brand,
                message: 'Brand updated successfully',
                updatedBy: req.user.id,
                updatedAt: new Date().toISOString()
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'PUT /api/brands/:id');
            }
            throw error;
        }
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'brand id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'DELETE /api/brands/:id');
        }

        try {
            const oldBrand = await this.brandsService.findOne(id);
            await this.brandsService.remove(id, req.user.role);
            
            // Log admin brand deletion
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'brands',
                    recordId: id,
                    action: 'DELETE',
                    oldValues: {
                        name: oldBrand.name,
                        category: oldBrand.category
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin deleted brand',
                    ipAddress,
                    userAgent
                });
                
                console.log('🏷️ ADMIN BRAND DELETE AUDIT:', {
                    brandId: id,
                    brandName: oldBrand.name,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log brand deletion audit:', auditError);
            }
            
            return {
                message: 'Brand deleted successfully',
                deletedBy: req.user.id,
                deletedAt: new Date().toISOString(),
                deletedBrandId: id
            };
        } catch (error) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'DELETE /api/brands/:id');
            }
            throw error;
        }
    }
}