import { Controller, Get, Post, Body, Param, UseGuards, Req, Res, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportAccessService } from './report-access.service';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/reports')
@UseGuards(AuthGuard('firebase-jwt'))
export class ReportAccessController {
    constructor(private readonly reportAccessService: ReportAccessService) {}

    private normalizeComponent(component?: string): string | undefined {
        if (!component) return undefined;
        return component.trim().toUpperCase();
    }

    // GET /api/reports/usage
    @Get('usage')
    async getUsage(@Req() req: any) {
        const result = await this.reportAccessService.getUsage(req.user.id);
        return { data: result };
    }

    // GET /api/reports/purchases
    @Get('purchases')
    async getPurchases(@Req() req: any) {
        const result = await this.reportAccessService.getPurchases(req.user.id);
        return { data: result };
    }

    // GET /api/reports/paywall-summary
    @Get('paywall-summary')
    async getPaywallSummary(@Req() req: any) {
        const result = await this.reportAccessService.getPaywallSummary(req.user.id, req.user.role);
        return { data: result };
    }

    // POST /api/reports/checkout
    // Body filters (all optional): brandName, color, style, search, zip, state_id, city_id
    // - If quota not exhausted: returns accessible reports, no payment needed
    // - If quota exhausted: returns Stripe checkout URL for locked reports
    @Post('checkout')
    async createCheckoutSession(
        @Req() req: any,
        @Body() filters: {
            brandName?: string;
            color?: string;
            style?: string;
            search?: string;
            zip?: string;
            state_id?: string;
            city_id?: string;
        } = {},
    ) {
        const result = await this.reportAccessService.createCheckoutSession(
            req.user.id,
            req.user.role,
            filters,
        );
        return { data: result };
    }

    // GET /api/reports/:propertyId/access
    @Get(':propertyId/access')
    async checkAccess(@Param('propertyId') propertyId: string, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        const result = await this.reportAccessService.checkAccess(req.user.id, propertyId);
        return { data: result };
    }

    // POST /api/reports/:propertyId/purchase
    @Post(':propertyId/purchase')
    async purchaseReport(@Param('propertyId') propertyId: string, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        const result = await this.reportAccessService.purchaseReport(req.user.id, propertyId);
        return { data: result, message: 'Checkout session created. Complete payment to access report.' };
    }

    // GET /api/reports/:propertyId/download
    @Get(':propertyId/download')
    async downloadReport(
        @Param('propertyId') propertyId: string, 
        @Query('project_type') projectType: string,
        @Query('componentid') componentId: string,
        @Req() req: any, 
        @Res() res: any
    ) {
        validateUUID(propertyId, 'property id');
        
        const normalizedComponent = this.normalizeComponent(projectType);
        
        const result = await this.reportAccessService.downloadReportWithComponent(req.user.id, propertyId, normalizedComponent, componentId);
        
        if (result.error) {
            return res.status(404).json({ error: result.error });
        }
        
        if (!result.pdfBuffer) {
            return res.status(404).json({ error: 'Report not available' });
        }
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="report-${propertyId}${projectType ? `-${projectType}` : ''}.pdf"`,
            'Content-Length': result.pdfBuffer.length,
        });
        res.end(result.pdfBuffer);
    }
}
