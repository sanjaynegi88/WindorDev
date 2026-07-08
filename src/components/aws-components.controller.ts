import { Controller, Post, UseGuards, Param, UseInterceptors, UploadedFiles, Req, HttpStatus, ForbiddenException, Put } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { AwsComponentsService } from './aws-components.service';
import { AwsReportsService } from '../reports/aws-reports.service';
import { LocalImageUploadService } from '../common/services/local-image-upload.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/aws')
@UseGuards(AuthGuard('firebase-jwt'))
export class AwsComponentsController {
    constructor(
        private readonly awsComponentsService: AwsComponentsService,
        private readonly awsReportsService: AwsReportsService,
        private readonly localImageUploadService: LocalImageUploadService,
    ) { }

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

    // ── Contractor / Admin upload ─────────────────────────────────────────────

    @Post('roofing/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadRoofingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'roofing id');
        const images = await this.awsReportsService.uploadComponentImages(id, 'ROOFING', files, req.user.id, req.user.role);
        return { data: images };
    }

    @Post('siding/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadSidingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'siding id');
        const images = await this.awsReportsService.uploadComponentImages(id, 'SIDING', files, req.user.id, req.user.role);
        return { data: images };
    }

    @Post('windows/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadWindowsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'windows id');
        const images = await this.awsReportsService.uploadComponentImages(id, 'WINDOWS', files, req.user.id, req.user.role);
        return { data: images };
    }

    @Post('doors/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'doors id');
        const images = await this.awsReportsService.uploadComponentImages(id, 'DOORS', files, req.user.id, req.user.role);
        return { data: images };
    }

    @Post('garage-doors/:id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'garage-doors id');
        const images = await this.awsReportsService.uploadComponentImages(id, 'GARAGE_DOORS', files, req.user.id, req.user.role);
        return { data: images };
    }

    // ── Property Owner upload ─────────────────────────────────────────────────

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

    @Post('garage-doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    @UseInterceptors(AnyFilesInterceptor())
    async uploadPropertyOwnerGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'garage-doors id');
        const images = await this.awsReportsService.uploadPropertyOwnerComponentImages(id, 'GARAGE_DOORS', files, req.user.id);
        return { data: images };
    }

    // ── Admin replace contractor images ──────────────────────────────────────

    @Put('admin/roofing/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateRoofingImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/admin/roofing/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImages(componentId, 'ROOFING', files, req.user.id, req.user.role);
        return { data: images, message: 'Roofing images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/siding/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateSidingImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/admin/siding/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImages(componentId, 'SIDING', files, req.user.id, req.user.role);
        return { data: images, message: 'Siding images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/windows/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateWindowsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/admin/windows/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImages(componentId, 'WINDOWS', files, req.user.id, req.user.role);
        return { data: images, message: 'Windows images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/doors/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateDoorsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/admin/doors/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImages(componentId, 'DOORS', files, req.user.id, req.user.role);
        return { data: images, message: 'Doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('admin/garage-doors/:componentId/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminUpdateGarageDoorsImages(@Param('componentId') componentId: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(componentId, 'component id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/admin/garage-doors/:componentId/images'); }
        const images = await this.localImageUploadService.adminUpdateComponentImages(componentId, 'GARAGE_DOORS', files, req.user.id, req.user.role);
        return { data: images, message: 'Garage Doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    // ── Admin edit property owner images ─────────────────────────────────────

    @Put('roofing/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerRoofingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'roofing id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/roofing/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'ROOFING', files, req.user.id);
        return { data: images, message: 'Property owner roofing images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('siding/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerSidingImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'siding id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/siding/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'SIDING', files, req.user.id);
        return { data: images, message: 'Property owner siding images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('windows/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerWindowsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'windows id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/windows/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'WINDOWS', files, req.user.id);
        return { data: images, message: 'Property owner windows images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'doors id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/doors/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'DOORS', files, req.user.id);
        return { data: images, message: 'Property owner doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }

    @Put('garage-doors/:id/property-owner/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(AnyFilesInterceptor())
    async adminEditPropertyOwnerGarageDoorsImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
        validateUUID(id, 'garage-doors id');
        if (req.user.role !== UserRole.ADMIN) { this.throwAdminOnlyError(req.user.role, 'PUT /api/aws/garage-doors/:id/property-owner/images'); }
        const images = await this.awsReportsService.adminEditPropertyOwnerImages(id, 'GARAGE_DOORS', files, req.user.id);
        return { data: images, message: 'Property owner garage doors images updated by administrator', updatedBy: req.user.id, updatedAt: new Date().toISOString() };
    }
}
