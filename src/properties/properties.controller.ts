import { Controller, Post, Get, Body, Param, UseGuards, Req, ForbiddenException, HttpStatus, Res, Query, Put, Delete, BadRequestException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PropertiesService } from './properties.service';
import { PdfService } from './pdf.service';
import { ReportAccessService } from '../report-access/report-access.service';
import { AwsS3Service } from '../common/services/aws-s3.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { sanitizeLogInput } from '../common/utils/security.util';
import type { Response } from 'express';

@Controller('api/properties')
@UseGuards(AuthGuard('firebase-jwt'))
export class PropertiesController {
    constructor(
        private readonly propertiesService: PropertiesService,
        private readonly pdfService: PdfService,
        private readonly reportAccessService: ReportAccessService,
        private readonly awsS3Service: AwsS3Service,
    ) { }

    private throwUnauthorizedError(userRole: string) {
        throw new ForbiddenException('Access Denied - Insufficient Permissions');
    }



    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async create(@Body() createPropertyDto: CreatePropertyDto, @Req() req: any) {
        const property = await this.propertiesService.create(createPropertyDto, req.user.id, req.user.role, req.user.city_id);
        return { 
            data: property,
            message: 'Property created successfully',
            createdBy: req.user.id
        };
    }

    @Post(':id/images')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'front_image', maxCount: 1 },
        { name: 'other_image', maxCount: 1 },
    ]))
    async uploadPropertyImages(
        @Param('id') propertyId: string,
        @Req() req: any,
        @UploadedFiles() files?: { front_image?: Express.Multer.File[]; other_image?: Express.Multer.File[] },
    ) {
        validateUUID(propertyId, 'property id');

        let frontImageUrl: string | null = null;
        let otherImageUrl: string | null = null;

        if (files?.front_image?.[0]) {
            const file = files.front_image[0];
            const key = this.awsS3Service.generateKey('property', propertyId, file.originalname, 'front');
            frontImageUrl = await this.awsS3Service.uploadFile(file, key);
        }

        if (files?.other_image?.[0]) {
            const file = files.other_image[0];
            const key = this.awsS3Service.generateKey('property', propertyId, file.originalname, 'other');
            otherImageUrl = await this.awsS3Service.uploadFile(file, key);
        }

        const updatedProperty = await this.propertiesService.updatePropertyImages(
            propertyId,
            req.user.id,
            frontImageUrl,
            otherImageUrl,
            req.user.role,
        );
        return {
            data: updatedProperty,
            message: 'Property images uploaded successfully',
        };
    }

    @Get('components/summary')
    @UseGuards(RolesGuard)
    @Roles(UserRole.CITY_INSPECTOR, UserRole.ADMIN, UserRole.INSURANCE_COMPANY, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER, UserRole.REALTOR)
    async getComponentSummaries(
        @Query('id') id: string, 
        @Query('brandName') brandName: string, 
        @Query('style') style: string,
        @Query('color') color: string,
        @Query('search') search: string,
        @Query('has_report') hasReport: string,
        @Query('property_type_id') propertyType: string,
        @Query('zip') zip: string,
        @Query('state_id') stateId: string,
        @Query('city_id') cityId: string,
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('is_purchased') isPurchased?: string,
        @Query('owner_email') ownerEmail?: string
    ) {
        if (id) {
            validateUUID(id, 'property id');
        }
        if (stateId) {
            validateUUID(stateId, 'state id');
        }
        if (cityId) {
            validateUUID(cityId, 'city id');
        }
        
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;
        
        const hasReportValue = hasReport === 'true' ? true : hasReport === 'false' ? false : undefined;
        const isPurchasedValue = isPurchased === 'true' ? true : isPurchased === 'false' ? false : undefined;
        const { data: enhancedProperties, total } = await this.propertiesService.getComponentSummaries(req.user.id, req.user.role, id, brandName, style, color, search, hasReportValue, propertyType, zip, pageNum, limitNum, stateId, cityId, isPurchasedValue, ownerEmail);
        
        if (enhancedProperties.length === 0) {
            return { 
                data: [],
                message: 'No properties found.' 
            };
        }

        if (id && enhancedProperties.length > 0) {
            return { data: enhancedProperties[0] };
        }

        return { 
            data: enhancedProperties,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1
            }
        };
    }

    @Get('components/summary/pdf')
    @UseGuards(RolesGuard)
    @Roles(UserRole.CITY_INSPECTOR, UserRole.ADMIN, UserRole.INSURANCE_COMPANY, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER, UserRole.REALTOR)
    async generateSummaryPDF(
        @Query('brandName') brandName: string, 
        @Query('style') style: string,
        @Query('color') color: string,
        @Query('search') search: string,
        @Query('has_report') hasReport: string,
        @Query('property_type_id') propertyType: string,
        @Query('zip') zip: string,
        @Query('state_id') stateId: string,
        @Query('city_id') cityId: string,
        @Req() req: any, 
        @Res() res: Response
    ) {
        try {
            res.setTimeout(600000); // 10 minutes timeout for large datasets

            const hasReportValue = hasReport === 'true' ? true : hasReport === 'false' ? false : undefined;

            if (stateId) {
                validateUUID(stateId, 'state id');
            }
            if (cityId) {
                validateUUID(cityId, 'city id');
            }

            // ADMIN: no limit. All other roles: top 10 only.
            const isAdmin = req.user.role === UserRole.ADMIN;
            const limit = req.user.role === UserRole.CITY_INSPECTOR ? 10 : (isAdmin ? undefined : 10);

            // Non-admin roles always filter to has_report=true to match what /reports/checkout counts.
            // Admin respects the has_report query param as-is.
            const effectiveHasReport = isAdmin ? hasReportValue : true;

            console.log(`Starting PDF generation for role=${sanitizeLogInput(req.user.role)}, has_report=${sanitizeLogInput(effectiveHasReport)}, limit=${sanitizeLogInput(limit ?? 'unlimited')}`);

            const { data: enhancedProperties } = await this.propertiesService.getComponentSummaries(
                req.user.id, req.user.role, undefined,
                brandName, style, color, search, effectiveHasReport,
                propertyType, zip, 1, limit, stateId, cityId
            );

            console.log(`Found ${sanitizeLogInput(enhancedProperties.length)} properties for PDF generation`);

            // ── ADMIN AND CITY_INSPECTOR ─────────────────────────────────────
            if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.CITY_INSPECTOR) {
                // ADMIN: all matching properties. CITY_INSPECTOR: top 10 in their city.
                const pdfProperties = enhancedProperties;
                
                if (pdfProperties.length === 0) {
                    const message = hasReportValue === false
                        ? 'No properties without reports found. This could mean all properties in the system have reports generated.'
                        : 'No matching properties found to generate PDF. Please adjust your search criteria.';

                    return res.status(404).json({
                        error: 'No Data Found',
                        message,
                        timestamp: new Date().toISOString()
                    });
                }

                const pdfBuffer = await Promise.race([
                    this.pdfService.generateSummaryReport(
                        pdfProperties,
                        { brandName, style, color, search, hasReport: hasReportValue, propertyType, zip },
                        undefined, // No paywall info for ADMIN/CITY_INSPECTOR
                    ),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('PDF generation timeout')), 480000) // 8 minutes
                    )
                ]) as Buffer;
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const reportType = hasReportValue === false ? 'without-reports' : hasReportValue === true ? 'with-reports' : 'all';
                const rolePrefix = req.user.role === UserRole.ADMIN ? 'admin' : 'inspector';
                const filename = `${rolePrefix}-properties-summary-${reportType}-${timestamp}.pdf`;
                
                console.log(`${req.user.role} PDF generated successfully: ${sanitizeLogInput(filename)} with ${sanitizeLogInput(pdfProperties.length)} properties`);
                
                res.set({
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Length': pdfBuffer.length,
                });
                
                return res.end(pdfBuffer);
            }

            // ── PROPERTY_OWNER GETS OWN PROPERTIES FREE + OTHERS WITH PAYWALL ──────────────────────────────
            if (req.user.role === UserRole.PROPERTY_OWNER) {
                // For PROPERTY_OWNER, fetch ALL properties (not just owned ones) to apply paywall logic
                const { data: allTop10Properties } = await this.propertiesService.getComponentSummaries(
                    req.user.id, UserRole.ADMIN, undefined, // Use ADMIN role to fetch all properties
                    brandName, style, color, search, effectiveHasReport,
                    propertyType, zip, 1, 10, stateId, cityId
                );
                
                if (allTop10Properties.length === 0) {
                    const message = hasReportValue === false
                        ? 'No properties without reports found. This could mean all properties in the system have reports generated.'
                        : 'No matching properties found to generate PDF. Please adjust your search criteria.';

                    return res.status(404).json({
                        error: 'No Data Found',
                        message,
                        timestamp: new Date().toISOString()
                    });
                }

                // Separate own properties (free) from others (paywall)
                const ownProperties = allTop10Properties.filter(p => p.property_owner_id === req.user.id);
                const otherProperties = allTop10Properties.filter(p => p.property_owner_id !== req.user.id);

                // Check if user has subscription for other properties
                if (otherProperties.length > 0) {
                    const { accessibleIds, paywallInfo, noSubscription } = await this.reportAccessService
                        .computePaywallForProperties(req.user.id, otherProperties);

                    if (noSubscription) {
                        return res.status(403).json({
                            error: 'No Active Membership',
                            message: 'You need an active membership plan to access reports for properties you do not own. Please purchase a plan to continue.',
                            timestamp: new Date().toISOString(),
                        });
                    }

                    // Combine own properties (always accessible) + accessible other properties
                    const accessibleOtherProperties = otherProperties.filter(p => accessibleIds.has(p.id));
                    const lockedOtherProperties = otherProperties.filter(p => !accessibleIds.has(p.id));
                    const pdfProperties = [...ownProperties, ...accessibleOtherProperties];
                    
                    // Calculate paywall info for locked other properties only
                    const adjustedPaywallInfo = lockedOtherProperties.length > 0 ? {
                        lockedCount: lockedOtherProperties.length,
                        totalAmountDue: paywallInfo?.totalAmountDue || 0
                    } : undefined;

                    const pdfBuffer = await Promise.race([
                        this.pdfService.generateSummaryReport(
                            pdfProperties,
                            { brandName, style, color, search, hasReport: hasReportValue, propertyType, zip },
                            adjustedPaywallInfo,
                        ),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('PDF generation timeout')), 480000) // 8 minutes
                        )
                    ]) as Buffer;
                    
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const reportType = hasReportValue === false ? 'without-reports' : hasReportValue === true ? 'with-reports' : 'all';
                    const filename = `owner-properties-summary-${reportType}-${timestamp}.pdf`;
                    
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                        'Content-Length': pdfBuffer.length,
                    });
                    
                    return res.end(pdfBuffer);
                } else {
                    // Only own properties, no paywall needed
                    const pdfBuffer = await Promise.race([
                        this.pdfService.generateSummaryReport(
                            ownProperties,
                            { brandName, style, color, search, hasReport: hasReportValue, propertyType, zip },
                            undefined, // No paywall info
                        ),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('PDF generation timeout')), 480000) // 8 minutes
                        )
                    ]) as Buffer;
                    
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const reportType = hasReportValue === false ? 'without-reports' : hasReportValue === true ? 'with-reports' : 'all';
                    const filename = `owner-properties-summary-${reportType}-${timestamp}.pdf`;
                    
                    res.set({
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                        'Content-Length': pdfBuffer.length,
                    });
                    
                    return res.end(pdfBuffer);
                }
            }

            // ── PAYWALL FILTER FOR OTHER ROLES ────────────────────────────────
            // For CONTRACTOR / INSURANCE_COMPANY: run paywall logic directly on
            // the fetched dataset so the same ordering is used for both the data
            // and the free-quota split. accessibleIds is null for other roles.
            let pdfProperties = enhancedProperties;
            let paywallInfo: { lockedCount: number; totalAmountDue: number } | undefined;

            const paywallRoles = [UserRole.CONTRACTOR, UserRole.MANUFACTURER, UserRole.REALTOR, UserRole.INSURANCE_COMPANY];
            if (paywallRoles.includes(req.user.role) && enhancedProperties.length > 0) {
                // For insurance company sub-accounts, resolve to parent account for subscription lookup
                let userIdForPaywall = req.user.id;
                if (req.user.role === UserRole.INSURANCE_COMPANY && req.user.sub_account && req.user.parent_id) {
                    userIdForPaywall = String(req.user.parent_id);
                }

                const { accessibleIds, paywallInfo: pw, noSubscription } = await this.reportAccessService
                    .computePaywallForProperties(userIdForPaywall, enhancedProperties);

                if (noSubscription) {
                    return res.status(403).json({
                        error: 'No Active Membership',
                        message: 'You need an active membership plan to access reports. Please purchase a plan to continue.',
                        timestamp: new Date().toISOString(),
                    });
                }

                pdfProperties = enhancedProperties.filter((p: any) => accessibleIds.has(p.id));
                paywallInfo = pw;
            }
            // ──────────────────────────────────────────────────────────────────

            if (pdfProperties.length === 0) {
                const message = hasReportValue === false
                    ? 'No properties without reports found. This could mean all properties in the system have reports generated.'
                    : 'No matching properties found to generate PDF. Please adjust your search criteria.';

                return res.status(404).json({
                    error: 'No Data Found',
                    message,
                    timestamp: new Date().toISOString()
                });
            }

            const pdfBuffer = await Promise.race([
                this.pdfService.generateSummaryReport(
                    pdfProperties,
                    { brandName, style, color, search, hasReport: hasReportValue, propertyType, zip },
                    paywallInfo,
                ),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PDF generation timeout')), 480000) // 8 minutes
                )
            ]) as Buffer;
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportType = hasReportValue === false ? 'without-reports' : hasReportValue === true ? 'with-reports' : 'all';
            const filename = `properties-summary-${reportType}-${timestamp}.pdf`;
            
            console.log(`PDF generated successfully: ${sanitizeLogInput(filename)}`);
            
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length,
            });
            
            res.end(pdfBuffer);
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            
            if (error.message === 'PDF generation timeout') {
                return res.status(408).json({
                    error: 'Request Timeout',
                    message: 'PDF generation took longer than 8 minutes and was cancelled. This usually happens with very large datasets.',
                    suggestion: hasReport === 'false' ? 
                        'Properties without reports can be a large dataset. Consider using filters to reduce processing time, or try again as the system may be under heavy load.' :
                        'Try using filters to reduce the dataset size, or try again later.',
                    timestamp: new Date().toISOString()
                });
            }
            
            if (error.message?.includes('Maximum response size') || error.message?.includes('memory') || error.message?.includes('heap')) {
                return res.status(413).json({
                    error: 'Dataset Too Large',
                    message: 'The dataset is too large to process in memory. This can happen with very large numbers of properties without reports.',
                    suggestion: 'The system is trying to process too much data at once. Please try using filters (brandName, style, color, search) to reduce the dataset size.',
                    timestamp: new Date().toISOString()
                });
            }
            
            if (error.message?.includes('Navigation timeout') || error.message?.includes('timeout')) {
                return res.status(408).json({
                    error: 'PDF Processing Timeout',
                    message: 'The PDF generation process timed out while processing the data.',
                    suggestion: 'Please try again. If the issue persists, try using filters to reduce the dataset size.',
                    timestamp: new Date().toISOString()
                });
            }
            
            return res.status(500).json({
                error: 'PDF Generation Failed',
                message: 'An unexpected error occurred while generating the PDF report.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                suggestion: 'Please try again. If the issue persists, try using filters to reduce the dataset size or contact support.',
                timestamp: new Date().toISOString()
            });
        }
    }

    @Get('user/with-components')
    async getUserPropertiesWithComponents(
        @Req() req: any,
        @Query('has_report') hasReport?: string
    ) {
        const hasReportValue = hasReport === undefined ? undefined : hasReport === 'true';
        const propertiesWithComponents = await this.propertiesService.getUserPropertiesWithComponents(req.user.id, req.user.role, hasReportValue);

        if (propertiesWithComponents.length === 0) {
            return {
                data: [],
                message: 'No properties added yet.'
            };
        }

        return {
            data: propertiesWithComponents
        };
    }

    @Get(':id/pdf')
    async generatePropertyPDF(
        @Param('id') id: string, 
        @Query('component') componentType: string,
        @Req() req: any, 
        @Res() res: Response
    ) {
        validateUUID(id, 'property id');
        
        const propertyWithComponents = await this.propertiesService.getPropertyWithComponentsForPDF(id, req.user.id, req.user.role, componentType);
        const pdfBuffer = await this.pdfService.generatePropertyReport(propertyWithComponents);
        
        const filename = componentType 
            ? `property-${componentType.toLowerCase()}-report-${id}.pdf`
            : `property-report-${id}.pdf`;
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
        });
        
        res.end(pdfBuffer);
    }

    @Put('admin/:id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CITY_INSPECTOR)
    async adminUpdateProperty(
        @Param('id') id: string,
        @Body() updatePropertyDto: UpdatePropertyDto,
        @Req() req: any
    ) {
        validateUUID(id, 'property id');
        
        const result = await this.propertiesService.adminUpdateProperty(id, updatePropertyDto, req);
        
        // Extract verification info if present
        const { updated_by_email, verification_action, ...propertyData } = result;
        
        const response: any = {
            data: propertyData,
            message: 'Property updated successfully',
            updatedBy: req.user.id,
            updatedByEmail: updated_by_email,
            updatedAt: new Date().toISOString()
        };
        
        // Add verification-specific information if this was a verification status update
        // if (verification_action) {
        //     response.verificationAction = verification_action;
            
        //     // Customize message based on verification action
        //     if (verification_action.action_type === 'APPROVED') {
        //         response.message = `Property verification status approved successfully by ${updated_by_email}`;
        //     } else if (verification_action.action_type === 'REVOKED') {
        //         response.message = `Property verification status revoked by ${updated_by_email}`;
        //     } else {
        //         response.message = `Property verification status updated by ${updated_by_email}`;
        //     }
        // }
        
        return response;
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async deleteProperty(
        @Param('id') id: string,
        @Req() req: any
    ) {
        validateUUID(id, 'property id');
        
        await this.propertiesService.deleteProperty(id, req);
        return {
            message: 'Property deleted successfully',
            deletedBy: req.user.id,
            deletedAt: new Date().toISOString()
        };
    }


    // Property Comment Endpoints
    @Post(':id/comments')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER)
    async addComment(
        @Param('id') propertyId: string,
        @Body() commentDto: CreateCommentDto,
        @Req() req: any
    ) {
        validateUUID(propertyId, 'property id');
        
        const comment = await this.propertiesService.addComment(propertyId, commentDto, req.user.id);
        return {
            data: comment,
            message: 'Comment added successfully'
        };
    }

    @Get(':id/comments')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER, UserRole.CITY_INSPECTOR, UserRole.ADMIN, UserRole.INSURANCE_COMPANY, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async getComments(
        @Param('id') propertyId: string,
        @Query('id') commentId: string,
        @Req() req: any
    ) {
        validateUUID(propertyId, 'property id');
        
        if (commentId) {
            validateUUID(commentId, 'comment id');
        }
        
        const comments = await this.propertiesService.getPropertyComments(propertyId, req.user.id, req.user.role, commentId);
        
        if (commentId && comments.length > 0) {
            return {
                data: comments[0]
            };
        }
        
        return {
            data: comments
        };
    }
}