import { Controller, Post, Body, UseGuards, Param, UseInterceptors, UploadedFiles, Req, HttpStatus, ForbiddenException, Put, UploadedFile, BadRequestException, Delete } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ComponentsService } from './components.service';
import { AwsReportsService } from '../reports/aws-reports.service';
import { LocalImageUploadService } from '../common/services/local-image-upload.service';
import { ComponentImageCategoriesService } from '../component-image-categories/component-image-categories.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RoofingDto } from './dto/roofing.dto';
import { SidingDto } from './dto/siding.dto';
import { WindowsDto } from './dto/windows.dto';
import { DoorsDto } from './dto/doors.dto';
import { GarageDoorsDto } from './dto/garage-doors.dto';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api')
@UseGuards(AuthGuard('firebase-jwt'))
export class ComponentsController {
    constructor(
        private readonly componentsService: ComponentsService,
        private readonly awsReportsService: AwsReportsService,
        private readonly localImageUploadService: LocalImageUploadService,
        private readonly imageCategoriesService: ComponentImageCategoriesService,
    ) { }

    private ensureUploadFiles(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
        if (!files || files.length === 0) {
            throw new BadRequestException(
                'No image files provided. Send multipart/form-data with a "file" field (single upload + category in body) or category-named file fields.',
            );
        }
        return files;
    }

    private async requireValidSingleUploadCategory(
        reqBody: any,
        componentType: string,
    ): Promise<string> {
        const raw =
            reqBody?.category ??
            reqBody?.image_category ??
            reqBody?.category_name;

        const category = typeof raw === 'string' ? raw.trim() : '';
        if (!category) {
            throw new BadRequestException(
                'Image category is required. Either upload using category field names, or include "category" in the request body for single-file uploads.',
            );
        }

        const allowed = await this.imageCategoriesService.getActiveCategories(componentType);
        if (!allowed.includes(category)) {
            throw new BadRequestException(
                `Invalid image category "${category}" for ${componentType}. Allowed: ${allowed.join(', ')}`,
            );
        }
        return category;
    }

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
                solution: 'Contact your system administrator for access or use regular user endpoints'
            }
        });
    }

    // Regular user endpoints (with report status checks)
    @Post('properties/:propertyId/roofing')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async saveRoofing(@Param('propertyId') propertyId: string, @Body() roofingDto: RoofingDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        
        try {
            roofingDto.property_id = propertyId;
            const roofing = await this.componentsService.saveRoofing(roofingDto, req.user.id, req.user.role);
            return { 
                data: roofing,
                message: 'Roofing component added successfully'
            };
        } catch (error: any) {
            throw (error as any);
        }
    }

    @Post('roofing/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadRoofingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'roofing id');
        const uploadFiles = this.ensureUploadFiles(files);

        // Check if single file upload or category-based upload
        if (uploadFiles.length === 1 && uploadFiles[0].fieldname === 'file') {
            // Single file upload
            const image = await this.localImageUploadService.uploadComponentImage(id, 'ROOFING', uploadFiles[0], req.user.id, req.user.role);
            return { data: image };
        } else {
            // Category-based upload
            const images = await this.localImageUploadService.uploadComponentImagesByCategory(id, 'ROOFING', uploadFiles, req.user.id, req.user.role);
            return { data: images };
        }
    }

    @Post('properties/:propertyId/siding')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async saveSiding(@Param('propertyId') propertyId: string, @Body() sidingDto: SidingDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        
        try {
            sidingDto.property_id = propertyId;
            const siding = await this.componentsService.saveSiding(sidingDto, req.user.id, req.user.role);
            return { 
                data: siding,
                message: 'Siding component added successfully'
            };
        } catch (error: any) {
            throw (error as any);
        }
    }

    @Post('siding/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadSidingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'siding id');
        const uploadFiles = this.ensureUploadFiles(files);

        // Check if single file upload or category-based upload
        if (uploadFiles.length === 1 && uploadFiles[0].fieldname === 'file') {
            // Single file upload
            const image = await this.localImageUploadService.uploadComponentImage(id, 'SIDING', uploadFiles[0], req.user.id, req.user.role);
            return { data: image };
        } else {
            // Category-based upload
            const images = await this.localImageUploadService.uploadComponentImagesByCategory(id, 'SIDING', uploadFiles, req.user.id, req.user.role);
            return { data: images };
        }
    }

    @Post('properties/:propertyId/windows')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async saveWindows(@Param('propertyId') propertyId: string, @Body() windowsDto: WindowsDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');

        try {
            windowsDto.property_id = propertyId;
            const windows = await this.componentsService.saveWindows(windowsDto, req.user.id, req.user.role);
            return {
                data: windows,
                message: 'Windows component added successfully',
            };
        } catch (error: any) {
            throw (error as any);
        }
    }

    @Post('windows/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadWindowsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any, @Body() body: any) {
        validateUUID(id, 'windows id');
        const uploadFiles = this.ensureUploadFiles(files);

        if (uploadFiles.length === 1 && uploadFiles[0].fieldname === 'file') {
            const category = await this.requireValidSingleUploadCategory(body, 'WINDOWS');
            (uploadFiles[0] as any).fieldname = category;
            const image = await this.localImageUploadService.uploadComponentImage(id, 'WINDOWS', uploadFiles[0], req.user.id, req.user.role);
            return { data: image };
        } else {
            const images = await this.localImageUploadService.uploadComponentImagesByCategory(id, 'WINDOWS', uploadFiles, req.user.id, req.user.role);
            return { data: images };
        }
    }

    @Post('properties/:propertyId/doors')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async saveDoors(@Param('propertyId') propertyId: string, @Body() doorsDto: DoorsDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');

        try {
            doorsDto.property_id = propertyId;
            const doors = await this.componentsService.saveDoors(doorsDto, req.user.id, req.user.role);
            return {
                data: doors,
                message: 'Doors component added successfully',
            };
        } catch (error: any) {
            throw (error as any);
        }
    }

    @Post('doors/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any, @Body() body: any) {
        validateUUID(id, 'doors id');
        const uploadFiles = this.ensureUploadFiles(files);

        if (uploadFiles.length === 1 && uploadFiles[0].fieldname === 'file') {
            const category = await this.requireValidSingleUploadCategory(body, 'DOORS');
            (uploadFiles[0] as any).fieldname = category;
            const image = await this.localImageUploadService.uploadComponentImage(id, 'DOORS', uploadFiles[0], req.user.id, req.user.role);
            return { data: image };
        } else {
            const images = await this.localImageUploadService.uploadComponentImagesByCategory(id, 'DOORS', uploadFiles, req.user.id, req.user.role);
            return { data: images };
        }
    }

    // Property Owner endpoints
    @Post('roofing/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerRoofingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'roofing id');

        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'ROOFING', files, req.user.id);
        return { data: images };
    }

    @Post('siding/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerSidingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'siding id');

        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'SIDING', files, req.user.id);
        return { data: images };
    }

    @Post('windows/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerWindowsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'windows id');

        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'WINDOWS', files, req.user.id);
        return { data: images };
    }

    @Post('doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'doors id');

        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'DOORS', files, req.user.id);
        return { data: images };
    }

    // Check report status for a property



    // Admin-only endpoints with proper error handling
    @Put('admin/roofing/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminUpdateRoofing(@Param('componentId') componentId: string, @Body() roofingDto: Partial<RoofingDto>, @Req() req: any) {
        validateUUID(componentId, 'component id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/roofing/:componentId');
        }

        const roofing = await this.componentsService.adminUpdateRoofing(componentId, roofingDto, req.user.id, req.user.role);
        return { 
            data: roofing,
            message: 'Roofing component updated by administrator',
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString()
        };
    }

    @Put('admin/siding/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminUpdateSiding(@Param('componentId') componentId: string, @Body() sidingDto: Partial<SidingDto>, @Req() req: any) {
        validateUUID(componentId, 'component id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/siding/:componentId');
        }

        const siding = await this.componentsService.adminUpdateSiding(componentId, sidingDto, req.user.id, req.user.role);
        return { 
            data: siding,
            message: 'Siding component updated by administrator',
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString()
        };
    }

    @Put('admin/windows/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminUpdateWindows(@Param('componentId') componentId: string, @Body() windowsDto: Partial<WindowsDto>, @Req() req: any) {
        validateUUID(componentId, 'component id');

        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/windows/:componentId');
        }

        const windows = await this.componentsService.adminUpdateWindows(componentId, windowsDto, req.user.id, req.user.role);
        return {
            data: windows,
            message: 'Windows component updated by administrator',
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString(),
        };
    }

    @Put('admin/doors/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminUpdateDoors(@Param('componentId') componentId: string, @Body() doorsDto: Partial<DoorsDto>, @Req() req: any) {
        validateUUID(componentId, 'component id');

        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/doors/:componentId');
        }

        const doors = await this.componentsService.adminUpdateDoors(componentId, doorsDto, req.user.id, req.user.role);
        return {
            data: doors,
            message: 'Doors component updated by administrator',
            updatedBy: req.user.id,
            updatedAt: new Date().toISOString(),
        };
    }

    @Put('admin/roofing/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateRoofingImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/roofing/:componentId/images');
        }

        const images = await this.localImageUploadService.adminUpdateComponentImagesByCategory(componentId, 'ROOFING', files, req.user.id, req.user.role);
        return { data: images, message: 'Roofing images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/siding/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateSidingImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/siding/:componentId/images');
        }

        const images = await this.localImageUploadService.adminUpdateComponentImagesByCategory(componentId, 'SIDING', files, req.user.id, req.user.role);
        return { data: images, message: 'Siding images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/windows/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateWindowsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/windows/:componentId/images');
        }

        const images = await this.localImageUploadService.adminUpdateComponentImagesByCategory(componentId, 'WINDOWS', files, req.user.id, req.user.role);
        return { data: images, message: 'Windows images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Delete('components/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminDeleteComponent(@Param('componentId') componentId: string, @Req() req: any) {
        validateUUID(componentId, 'component id');

        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'DELETE /api/components/:componentId');
        }

        await this.componentsService.adminDeleteComponent(componentId, req.user.id, req.user.role);
        return { message: 'Component deleted successfully', deletedAt: new Date().toISOString(), deletedBy: req.user.id };
    }

    @Put('admin/doors/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateDoorsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/doors/:componentId/images');
        }

        const images = await this.localImageUploadService.adminUpdateComponentImagesByCategory(componentId, 'DOORS', files, req.user.id, req.user.role);
        return { data: images, message: 'Doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    // Admin endpoints for editing property owner images
    @Put('roofing/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerRoofingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'roofing id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/roofing/:id/property-owner/images'); }

        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'ROOFING', files, req.user.id);
        return { data: images, message: 'Property owner roofing images updated by administrator (AWS S3)', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('siding/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerSidingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'siding id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/siding/:id/property-owner/images'); }

        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'SIDING', files, req.user.id);
        return { data: images, message: 'Property owner siding images updated by administrator (AWS S3)', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('windows/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerWindowsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'windows id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/windows/:id/property-owner/images'); }

        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'WINDOWS', files, req.user.id);
        return { data: images, message: 'Property owner windows images updated by administrator (AWS S3)', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'doors id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/doors/:id/property-owner/images'); }

        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'DOORS', files, req.user.id);
        return { data: images, message: 'Property owner doors images updated by administrator (AWS S3)', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    // ── Garage Doors endpoints ────────────────────────────────────────────────

    @Post('properties/:propertyId/garage-doors')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async saveGarageDoors(@Param('propertyId') propertyId: string, @Body() garageDoorsDto: GarageDoorsDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        garageDoorsDto.property_id = propertyId;
        const garageDoors = await this.componentsService.saveGarageDoors(garageDoorsDto, req.user.id, req.user.role);
        return { data: garageDoors, message: 'Garage Doors component added successfully' };
    }

    @Post('garage-doors/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any, @Body() body: any) {
        validateUUID(id, 'garage-doors id');
        const uploadFiles = this.ensureUploadFiles(files);
        if (uploadFiles.length === 1 && uploadFiles[0].fieldname === 'file') {
            const category = await this.requireValidSingleUploadCategory(body, 'GARAGE_DOORS');
            (uploadFiles[0] as any).fieldname = category;
            const image = await this.localImageUploadService.uploadComponentImage(id, 'GARAGE_DOORS', uploadFiles[0], req.user.id, req.user.role);
            return { data: image };
        } else {
            const images = await this.localImageUploadService.uploadComponentImagesByCategory(id, 'GARAGE_DOORS', uploadFiles, req.user.id, req.user.role);
            return { data: images };
        }
    }

    @Post('garage-doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'garage-doors id');
        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'GARAGE_DOORS', files, req.user.id);
        return { data: images };
    }

    @Put('admin/garage-doors/:componentId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminUpdateGarageDoors(@Param('componentId') componentId: string, @Body() garageDoorsDto: Partial<GarageDoorsDto>, @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/garage-doors/:componentId'); }
        const garageDoors = await this.componentsService.adminUpdateGarageDoors(componentId, garageDoorsDto, req.user.id, req.user.role);
        return { data: garageDoors, message: 'Garage Doors component updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/garage-doors/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateGarageDoorsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/admin/garage-doors/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImagesByCategory(componentId, 'GARAGE_DOORS', files, req.user.id, req.user.role);
        return { data: images, message: 'Garage Doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('garage-doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'garage-doors id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/garage-doors/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'GARAGE_DOORS', files, req.user.id);
        return { data: images, message: 'Property owner garage doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }
}
