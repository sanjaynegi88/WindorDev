import { Controller, Post, Get, Body, Param, UseGuards, UseInterceptors, UploadedFiles, Request, ForbiddenException, HttpStatus, Put } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

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

    @Get('reports/types')
    async getReportTypes() {
        return {
            data: {
                report_types: [
                    { name: 'ROOFING' },
                    { name: 'SIDING' },
                    { name: 'WINDOWS' },
                    { name: 'DOORS' },
                    { name: 'GARAGE_DOORS' },
                ]
            }
        };
    }

    @Get('components/:propertyId/summary')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER)
    async getComponentsSummary(@Param('propertyId') propertyId: string, @Request() req: any) {
        validateUUID(propertyId, 'property id');
        
        const reportData = await this.reportsService.generateReport(propertyId, req.user.id, req.user.role);
        return { 
            data: reportData,
            message: 'Components summary retrieved successfully'
        };
    }

    @Get('summary/:propertyId/pdf')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER)
    async getSummaryPdf(@Param('propertyId') propertyId: string, @Request() req: any) {
        validateUUID(propertyId, 'property id');
        
        const reportData = await this.reportsService.generateReport(propertyId, req.user.id, req.user.role);
        return { 
            data: reportData,
            message: 'Summary PDF data retrieved successfully',
            pdf_url: `/api/reports/${reportData.report.id}/pdf` // Placeholder for actual PDF generation
        };
    }

    @Post('properties/:propertyId/generate-report')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER)
    async generateReport(@Param('propertyId') propertyId: string, @Request() req: any) {
        validateUUID(propertyId, 'property id');
        
        const reportData = await this.reportsService.generateReport(propertyId, req.user.id, req.user.role);
        return { 
            data: reportData,
            message: 'Report generated successfully'
        };
    }
}