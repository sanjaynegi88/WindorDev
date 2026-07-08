import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { Report } from '../entities/report.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { StripeConfigService } from '../stripe/stripe-config.service';
import { PropertiesService } from '../properties/properties.service';
import { PdfService } from '../properties/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import Stripe from 'stripe';

const PAYWALL_REPORT_LIMIT = 10;

@Injectable()
export class ReportAccessService {
    private stripe: Stripe;

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>,
        @InjectRepository(Report)
        private reportRepository: Repository<Report>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(UserReportUsage)
        private userReportUsageRepository: Repository<UserReportUsage>,
        @InjectRepository(ReportPurchase)
        private reportPurchaseRepository: Repository<ReportPurchase>,
        private stripeConfig: StripeConfigService,
        private propertiesService: PropertiesService,
        private pdfService: PdfService,
        private notificationsService: NotificationsService,
        private appSettingsService: AppSettingsService,
    ) {
        this.stripe = this.stripeConfig.getStripe();
    }

    private async getReportPriceDollars(): Promise<number> {
        const val = await this.appSettingsService.getValue('report_price', '69.00');
        return parseFloat(val);
    }

    private async getReportPriceCents(): Promise<number> {
        return Math.round(await this.getReportPriceDollars() * 100);
    }

    // Returns the main account ID for a user (themselves if main, parent_id if sub)
    private async getCompanyOwnerId(user: User): Promise<string> {
        if (!user.sub_account) return user.id;
        return user.parent_id;
    }

    // Returns all user IDs in the same company (main + all subs)
    private async getCompanyUserIds(companyOwnerId: string): Promise<string[]> {
        const members = await this.userRepository.find({
            where: [{ id: companyOwnerId }, { parent_id: companyOwnerId }],
            select: ['id']
        });
        return members.map(m => m.id);
    }

    async checkAccess(userId: string, propertyId: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const property = await this.propertyRepository.findOne({ where: { id: propertyId }, relations: ['city'] });
        if (!property) throw new NotFoundException('Property not found');

        switch (user.role) {
            case UserRole.ADMIN:
                return { hasAccess: true, accessType: 'free', requiresPurchase: false };
            case UserRole.CONTRACTOR:
            case UserRole.MANUFACTURER:
            case UserRole.REALTOR:
                return this.checkContractorAccess(userId, propertyId);
            case UserRole.PROPERTY_OWNER:
                return this.checkPropertyOwnerAccess(userId, propertyId, property);
            case UserRole.CITY_INSPECTOR:
                return this.checkCityInspectorAccess(user, property);
            case UserRole.INSURANCE_COMPANY:
                return this.checkInsuranceAccess(user, propertyId);
            default:
                return { hasAccess: false, accessType: null, reason: 'Invalid user role' };
        }
    }

    async purchaseReport(userId: string, propertyId: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const reportPriceDollars = await this.getReportPriceDollars();
        const reportPriceCents = await this.getReportPriceCents();

        if (user.role !== UserRole.INSURANCE_COMPANY && (user.role !== UserRole.CONTRACTOR && user.role !== UserRole.MANUFACTURER && user.role !== UserRole.REALTOR && user.role !== UserRole.PROPERTY_OWNER)) {
            throw new ForbiddenException('Only insurance companies, contractors, manufacturers, realtors, and property owners can purchase individual reports');
        }

        // For insurance: only main account can purchase
        if (user.role === UserRole.INSURANCE_COMPANY && user.sub_account) {
            throw new ForbiddenException('Only the main insurance company account can purchase reports. Sub-accounts inherit access automatically.');
        }

        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) throw new NotFoundException('Property not found');

        // For contractors, manufacturers, realtors, property owners: can purchase reports for any property with reports
        if ((user.role === UserRole.CONTRACTOR || user.role === UserRole.MANUFACTURER || user.role === UserRole.REALTOR || user.role === UserRole.PROPERTY_OWNER)) {
            if (!property.has_report) {
                throw new ForbiddenException('No report available for this property');
            }
        }

        if (user.role === UserRole.PROPERTY_OWNER && property.property_owner_id === userId) {
            throw new ForbiddenException('You already have free access to your own properties. No purchase required.');
        }

        // Check if already purchased by anyone in the company
        const companyOwnerId = await this.getCompanyOwnerId(user);
        const companyUserIds = await this.getCompanyUserIds(companyOwnerId);
        const existing = await this.reportPurchaseRepository.findOne({
            where: { purchasedByUserId: In(companyUserIds), propertyId, purchaseType: 'one_time' }
        });
        if (existing) throw new BadRequestException('Report already purchased by your company for this property');

        let stripeCustomerId = (await this.subscriptionRepository.findOne({
            where: { userId }, order: { createdAt: 'DESC' }
        }))?.stripeCustomerId;

        // Only use stripeCustomerId if it's a real Stripe customer ID (starts with 'cus_')
        if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                address: { country: 'US' },
                metadata: { userId }
            });
            stripeCustomerId = customer.id;
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer: stripeCustomerId,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    unit_amount: reportPriceCents,
                    product_data: { name: `Property Report - ${property.address}` }
                },
                quantity: 1
            }],
            // session_id is appended so the frontend can pass it to /stripe/confirm-payment
            success_url: `${frontendUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/purchase/cancel`,
            locale: 'en',
            metadata: {
                type: 'SINGLE_REPORT_UNLOCK',
                userId,
                propertyId,
                purchaseType: 'one_time',
            }
        });

        return { checkoutUrl: session.url, amount: reportPriceDollars };
    }

    async getUsage(userId: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // Get subscription from main account
        const companyOwnerId = await this.getCompanyOwnerId(user);
        const subscription = await this.getActiveSubscription(companyOwnerId);
        if (!subscription) return { plan: null, used: 0, limit: 0, remaining: 0 };

        const companyUserIds = await this.getCompanyUserIds(companyOwnerId);
        const { start, end } = this.getBillingPeriod(subscription);

        // Count usage in current billing period
        const used = await this.userReportUsageRepository
            .createQueryBuilder('u')
            .where('u.user_id IN (:...ids)', { ids: companyUserIds })
            .andWhere('u.subscription_id = :subId', { subId: subscription.id })
            .andWhere('u.billing_period_start >= :start', { start })
            .andWhere('u.billing_period_start <= :end', { end })
            .getCount();

        // Count total purchased reports (all time) to add to quota
        const purchasedReportsCount = await this.userReportUsageRepository
            .createQueryBuilder('u')
            .where('u.user_id IN (:...ids)', { ids: companyUserIds })
            .andWhere('u.is_free = false')
            .getCount();

        const baseLimit = subscription.plan.maxReports;
        
        if (this.hasUnlimitedReportAccess(subscription)) {
            return {
                plan: subscription.plan.name,
                used,
                limit: Number.MAX_SAFE_INTEGER,
                remaining: Number.MAX_SAFE_INTEGER,
                baseLimit: 0,
                purchasedReports: purchasedReportsCount,
                unlimitedAccess: true
            };
        }

        // maxReports = 0 → no access allowed
        if (baseLimit === 0) {
            return { 
                plan: subscription.plan.name,
                used: 0,
                limit: 0,
                remaining: 0,
                baseLimit: 0,
                purchasedReports: purchasedReportsCount,
                error: 'No report access allowed with current plan'
            };
        }

        const totalLimit = baseLimit + purchasedReportsCount;
        
        return { 
            plan: subscription.plan.name, 
            used, 
            limit: totalLimit, 
            remaining: Math.max(0, totalLimit - used),
            baseLimit,
            purchasedReports: purchasedReportsCount
        };
    }

    async getPurchases(userId: string): Promise<any[]> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // Show all company purchases
        const companyOwnerId = await this.getCompanyOwnerId(user);
        const companyUserIds = await this.getCompanyUserIds(companyOwnerId);

        const purchases = await this.reportPurchaseRepository.find({
            where: { purchasedByUserId: In(companyUserIds), purchaseType: 'one_time' },
            order: { purchaseDate: 'DESC' }
        });
        return purchases.map(p => ({
            id: p.id,
            propertyId: p.propertyId,
            amount: p.amountPaid,
            purchaseDate: p.purchaseDate
        }));
    }

    async downloadReport(userId: string, propertyId: string): Promise<Buffer> {
        const result = await this.downloadReportWithComponent(userId, propertyId);
        
        if (result.error) {
            throw new ForbiddenException(result.error);
        }
        
        return result.pdfBuffer!;
    }

    async downloadReportWithComponent(userId: string, propertyId: string, componentType?: string, componentId?: string): Promise<{ pdfBuffer?: Buffer; error?: string }> {
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (!user) return { error: 'User not found' };

            const access = await this.checkAccess(userId, propertyId);

            if (!access.hasAccess) {
                return {
                    error: access.reason || 'Access denied'
                };
            }

            // If project_type is specified, check if it exists for this property
            if (componentType) {
                const hasComponent = await this.checkComponentExists(propertyId, componentType);
                if (!hasComponent) {
                    return {
                        error: `No ${componentType} project type found for this property`
                    };
                }
            }

            // Consume quota only for new membership access
            if (access.accessType === 'membership' && access.subscriptionId) {
                const alreadyUsed = await this.userReportUsageRepository.findOne({
                    where: { userId, reportId: propertyId }
                });
                if (!alreadyUsed) {
                    await this.consumeMembershipReport(userId, propertyId, access.subscriptionId);
                }
            }

            // Record usage for free access roles
            if (
                user.role === UserRole.CITY_INSPECTOR ||
                user.role === UserRole.ADMIN ||
                user.role === UserRole.PROPERTY_OWNER
            ) {
                const alreadyRecorded = await this.userReportUsageRepository.findOne({
                    where: { userId, reportId: propertyId }
                });
                if (!alreadyRecorded) {
                    await this.userReportUsageRepository.save(
                        this.userReportUsageRepository.create({
                            userId,
                            subscriptionId: null,
                            reportId: propertyId,
                            billingPeriodStart: new Date(),
                            billingPeriodEnd: new Date(),
                            isFree: true,
                            priceCharged: 0,
                        })
                    );
                }
            }

            const propertyData = await this.propertiesService.getPropertyWithComponentsForPDF(
                propertyId,
                userId,
                user.role || '',
                componentType,
            );
            
            if (!propertyData || Object.keys(propertyData).length === 0) {
                return { error: 'Property data not found' };
            }

            if (user.role === UserRole.CITY_INSPECTOR && propertyData.projects) {
                const validProjectIds = new Set();
                propertyData.projects = propertyData.projects.filter((p: any) => {
                    if (p.need_permit === false || p.permit_upload) {
                        validProjectIds.add(p.id);
                        return true;
                    }
                    return false;
                });

                if (propertyData.components) {
                    propertyData.components = propertyData.components.filter((c: any) =>
                        !c.project_id || validProjectIds.has(c.project_id)
                    );
                }
            }

            // Filter components and projects if componentId is provided
            if (componentId && propertyData.components) {
                propertyData.components = propertyData.components.filter((c: any) => c.id === componentId);
                if (propertyData.components.length === 0) {
                    return { error: 'Specific component not found for this property.' };
                }
                
                // Also filter projects to only include the project that owns this component
                if (propertyData.projects) {
                    const projectId = propertyData.components[0].project_id;
                    propertyData.projects = propertyData.projects.filter((p: any) => p.id === projectId);
                }
            }

            // Notify Premium contractor when someone downloads a report on their property
            try {
                const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
                if (property?.created_by && property.created_by !== userId) {
                    const creatorSub = await this.getActiveSubscription(property.created_by);
                    if (creatorSub?.plan?.level === 'GOLD') {
                        await this.notificationsService.notifyContractorReportDownloaded(
                            property.created_by,
                            property.address || 'No address provided',
                            propertyId,
                            userId
                        );
                    }
                }
            } catch (err) {
                console.error('Failed to send contractor report download notification:', err);
            }

            const pdfBuffer = await this.pdfService.generatePropertyReport(propertyData);
            
            if (!pdfBuffer) {
                return { error: 'Unable to generate PDF report' };
            }
            
            return { pdfBuffer };
        } catch (error) {
            console.error('Error in downloadReportWithComponent:', error);
            return { error: 'Report not available' };
        }
    }

    private async checkComponentExists(propertyId: string, componentType: string): Promise<boolean> {
        return this.propertiesService.checkComponentExists(propertyId, componentType);
    }

    async consumeMembershipReport(userId: string, propertyId: string, subscriptionId: string): Promise<void> {
        const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
        if (!subscription) return;

        const { start, end } = this.getBillingPeriod(subscription);
        await this.userReportUsageRepository.save(
            this.userReportUsageRepository.create({
                userId,
                subscriptionId,
                reportId: propertyId,
                billingPeriodStart: start,
                billingPeriodEnd: end
            })
        );
    }

    private async checkContractorAccess(userId: string, propertyId: string): Promise<any> {
        // Contractors can access ANY property with reports (not just their own)
        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) {
            return { hasAccess: false, accessType: null, requiresPurchase: false, reason: 'Property not found' };
        }
        
        // Check if property has a report generated
        if (!property.has_report) {
            return { hasAccess: false, accessType: null, requiresPurchase: false, reason: 'No report available for this property' };
        }

        // Contractors get free access to properties they created
        if (property.created_by === userId) {
            return { hasAccess: true, accessType: 'free', requiresPurchase: false, reason: 'Property created by contractor' };
        }

        // Check if contractor already purchased this specific report
        const purchase = await this.reportPurchaseRepository.findOne({
            where: { purchasedByUserId: userId, propertyId, purchaseType: 'one_time' }
        });
        if (purchase) return { hasAccess: true, accessType: 'one_time', requiresPurchase: false };

        // Check contractor's subscription for membership access
        const subscription = await this.getActiveSubscription(userId);
        if (!subscription) {
            return { hasAccess: false, accessType: null, requiresPurchase: true, reason: 'Active contractor membership or one-time purchase required' };
        }

        if (this.hasUnlimitedReportAccess(subscription)) {
            return { hasAccess: true, accessType: 'membership', requiresPurchase: false, subscriptionId: subscription.id };
        }

        const maxReports = subscription.plan.maxReports;

        // maxReports = 0 → no access allowed
        if (maxReports === 0) {
            return { hasAccess: false, accessType: null, requiresPurchase: true, reason: 'Your current membership plan does not allow accessing reports. Please upgrade your plan.' };
        }

        if (maxReports > 0) {
            const alreadyUsed = await this.userReportUsageRepository.findOne({
                where: { userId, reportId: propertyId }
            });
            if (alreadyUsed) return { hasAccess: true, accessType: 'membership', requiresPurchase: false };

            const { start, end } = this.getBillingPeriod(subscription);
            const used = await this.userReportUsageRepository
                .createQueryBuilder('u')
                .where('u.user_id = :userId', { userId })
                .andWhere('u.subscription_id = :subId', { subId: subscription.id })
                .andWhere('u.billing_period_start >= :start', { start })
                .andWhere('u.billing_period_start <= :end', { end })
                .getCount();

            const remaining = Math.max(0, subscription.plan.maxReports - used);
            if (remaining <= 0) {
                return { hasAccess: false, accessType: null, requiresPurchase: true, remainingReports: 0, reason: 'Quota exhausted - purchase required ($69)' };
            }
            return { hasAccess: true, accessType: 'membership', requiresPurchase: false, remainingReports: remaining, subscriptionId: subscription.id };
        }
    }

    private async checkPropertyOwnerAccess(userId: string, propertyId: string, property: Property): Promise<any> {
        if (property.property_owner_id === userId) {
            return { hasAccess: true, accessType: 'free', requiresPurchase: false };
        }

        // Check if property owner already purchased this specific report
        const purchase = await this.reportPurchaseRepository.findOne({
            where: { purchasedByUserId: userId, propertyId, purchaseType: 'one_time' }
        });
        
        if (purchase) {
            return { hasAccess: true, accessType: 'one_time', requiresPurchase: false };
        }

        return { hasAccess: false, accessType: null, requiresPurchase: true, reason: 'You must purchase this report to view it' };
    }

    private async checkCityInspectorAccess(user: User, property: Property): Promise<any> {
        if (user.city_id !== property.city_id) {
            return { hasAccess: false, accessType: null, requiresPurchase: false, reason: 'Property not in your assigned city' };
        }
        return { hasAccess: true, accessType: 'free', requiresPurchase: false };
    }

    private async checkInsuranceAccess(user: User, propertyId: string): Promise<any> {
        const companyOwnerId = await this.getCompanyOwnerId(user);
        const companyUserIds = await this.getCompanyUserIds(companyOwnerId);

        // Step 1: check if ANY company member purchased this report
        const purchase = await this.reportPurchaseRepository.findOne({
            where: { purchasedByUserId: In(companyUserIds), propertyId, purchaseType: 'one_time' }
        });
        if (purchase) return { hasAccess: true, accessType: 'one_time', requiresPurchase: false };

        // Step 2: get subscription from main account only
        const subscription = await this.getActiveSubscription(companyOwnerId);
        if (!subscription) {
            return { hasAccess: false, accessType: null, requiresPurchase: true, remainingReports: 0, reason: 'No subscription - purchase required ($69)' };
        }

        if (this.hasUnlimitedReportAccess(subscription)) {
            return { hasAccess: true, accessType: 'membership', requiresPurchase: false, subscriptionId: subscription.id };
        }

        // Step 3: check if this report was already accessed by anyone in the company (no double-count)
        const alreadyUsed = await this.userReportUsageRepository
            .createQueryBuilder('u')
            .where('u.user_id IN (:...ids)', { ids: companyUserIds })
            .andWhere('u.report_id = :reportId', { reportId: propertyId })
            .getOne();
        if (alreadyUsed) return { hasAccess: true, accessType: 'membership', requiresPurchase: false };

        // Step 4: count company-wide usage in current billing period
        const { start, end } = this.getBillingPeriod(subscription);
        const used = await this.userReportUsageRepository
            .createQueryBuilder('u')
            .where('u.user_id IN (:...ids)', { ids: companyUserIds })
            .andWhere('u.subscription_id = :subId', { subId: subscription.id })
            .andWhere('u.billing_period_start >= :start', { start })
            .andWhere('u.billing_period_start <= :end', { end })
            .getCount();

        const remaining = Math.max(0, subscription.plan.maxReports - used);
        if (remaining > 0) {
            return { hasAccess: true, accessType: 'membership', requiresPurchase: false, remainingReports: remaining, subscriptionId: subscription.id };
        }

        return { hasAccess: false, accessType: null, requiresPurchase: true, remainingReports: 0, reason: 'Company quota exhausted - purchase required ($69)' };
    }

    private hasUnlimitedReportAccess(subscription: any): boolean {
        return !!subscription?.plan?.isUnlimitedAccess;
    }

    private async getActiveSubscription(userId: string): Promise<any> {
        return this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });
    }

    private getBillingPeriod(subscription: any): { start: Date; end: Date } {
        const end = new Date(subscription.currentPeriodEnd);
        const start = new Date(subscription.createdAt || subscription.currentPeriodEnd);
        // Use subscription createdAt as period start if within same month as end
        const createdAt = new Date(subscription.createdAt);
        const periodStart = new Date(end);
        periodStart.setMonth(periodStart.getMonth() - (subscription.billingCycle === 'monthly' ? 1 : 12));
        // Use whichever is later: calculated period start or subscription creation
        return { start: createdAt > periodStart ? createdAt : periodStart, end };
    }

    // ─── PAYWALL METHODS ────────────────────────────────────────────────────────

    /**
     * Fetch the stable top-10 reports for a user (ORDER BY created_at DESC LIMIT 10).
     * Returns properties that have reports, visible to the user based on their role.
     */
    private async getTop10Reports(userId: string, userRole: string): Promise<Property[]> {
        const query = this.propertyRepository.createQueryBuilder('property')
            .where('property.has_report = true')
            .orderBy('property.created_at', 'DESC')
            .limit(PAYWALL_REPORT_LIMIT);

        if ((userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER || userRole === UserRole.REALTOR)) {
            // Contractors see all properties with reports
        } else if (userRole === UserRole.INSURANCE_COMPANY) {
            // Insurance companies see all properties with reports
        } else if (userRole === UserRole.PROPERTY_OWNER) {
            query.andWhere('property.property_owner_id = :userId', { userId });
        } else if (userRole === UserRole.CITY_INSPECTOR) {
            const inspector = await this.userRepository.findOne({ where: { id: userId } });
            if (inspector?.city_id) {
                query.andWhere('property.city_id = :cityId', { cityId: inspector.city_id });
            }
        }

        return query.getMany();
    }

    /**
     * Compute paywall split from an already-fetched list of properties.
     * Used by the summary/pdf endpoint so both the data fetch and the
     * paywall logic operate on the exact same dataset.
     *
     * Returns:
     *   accessibleIds  – Set of property IDs the user may see in the PDF
     *   paywallInfo    – { lockedCount, totalAmountDue } when payment is needed, else undefined
     */
async computePaywallForProperties(
    userId: string,
    properties: { id: string }[],
): Promise<{
    accessibleIds: Set<string>;
    paywallInfo?: { lockedCount: number; totalAmountDue: number };
    noSubscription?: boolean;
    noAccess?: boolean;
}> {
    // Get user and company info
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
        return { accessibleIds: new Set(), noSubscription: true };
    }

    const companyOwnerId = await this.getCompanyOwnerId(user);
    const subscription = await this.getActiveSubscription(companyOwnerId);

    // No active subscription → no free quota, no access at all
    if (!subscription) {
        return { accessibleIds: new Set(), noSubscription: true };
    }

    if (this.hasUnlimitedReportAccess(subscription)) {
        return { accessibleIds: new Set(properties.map(p => p.id)) };
    }

    const baseFreeQuota = subscription.plan?.maxReports ?? 0;

    // maxReports = 0 → no access allowed
    if (baseFreeQuota === 0) {
        return { accessibleIds: new Set(), noAccess: true };
    }

    if (properties.length === 0) {
        return { accessibleIds: new Set() };
    }

    // Check which properties are unlocked by ANY company member
    const companyUserIds = await this.getCompanyUserIds(companyOwnerId);
    const reportIds = properties.map(p => p.id);
    const usageRecords = await this.userReportUsageRepository
        .createQueryBuilder('u')
        .where('u.user_id IN (:...ids)', { ids: companyUserIds })  // ✅ Company-wide
        .andWhere('u.report_id IN (:...ids)', { ids: reportIds })
        .getMany();

    const unlockedIds = new Set(usageRecords.map(u => u.reportId));

    // Count purchased reports (non-free usage records) to add to quota
    const purchasedReportsCount = await this.userReportUsageRepository
        .createQueryBuilder('u')
        .where('u.user_id IN (:...ids)', { ids: companyUserIds })
        .andWhere('u.is_free = false')
        .getCount();

    // Total effective quota = base membership quota + purchased reports
    const totalQuota = baseFreeQuota + purchasedReportsCount;

        // Walk the list in stable order: first totalQuota are accessible, rest locked unless already unlocked
        const accessibleIds = new Set<string>();
        let lockedCount = 0;

        properties.forEach((prop: any, idx) => {
            if (idx < totalQuota || unlockedIds.has(prop.id) || prop.created_by === userId) {
                accessibleIds.add(prop.id);
            } else {
                lockedCount++;
            }
        });

        if (lockedCount === 0) {
            return { accessibleIds };
        }

        const reportPriceDollars = await this.getReportPriceDollars();

        return {
            accessibleIds,
            paywallInfo: {
                lockedCount,
                totalAmountDue: lockedCount * reportPriceDollars,
            },
        };
    }

    /**
     * GET /summary/pdf paywall check (used by /paywall-summary endpoint).
     * Returns accessible reports + locked count + total amount to pay.
     */
    async getPaywallSummary(userId: string, userRole: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (userRole === UserRole.CITY_INSPECTOR || userRole === UserRole.ADMIN || userRole === UserRole.PROPERTY_OWNER) {
            const top10 = await this.getTop10Reports(userId, userRole);
            return {
                accessible: top10,
                lockedCount: 0,
                totalAmountDue: 0,
                requiresPayment: false,
                unlimitedAccess: true
            };
        }

        const companyOwnerId = await this.getCompanyOwnerId(user);
        const subscription = await this.getActiveSubscription(companyOwnerId);

        if (subscription && this.hasUnlimitedReportAccess(subscription)) {
            const top10 = await this.getTop10Reports(userId, userRole);
            return {
                accessible: top10,
                lockedCount: 0,
                totalAmountDue: 0,
                requiresPayment: false,
                unlimitedAccess: true
            };
        }

        const baseFreeQuota = subscription?.plan?.maxReports ?? 0;

        // maxReports = 0 → no access allowed
        if (baseFreeQuota === 0) {
            return { accessible: [], lockedCount: 0, totalAmountDue: 0, requiresPayment: false, noAccess: true };
        }

        const top10 = await this.getTop10Reports(userId, userRole);
        if (top10.length === 0) {
            return { accessible: [], lockedCount: 0, totalAmountDue: 0, requiresPayment: false };
        }

        const { accessibleIds, paywallInfo } = await this.computePaywallForProperties(userId, top10);

        const accessible = top10.filter(p => accessibleIds.has(p.id));

        if (!paywallInfo) {
            return { accessible: top10, lockedCount: 0, totalAmountDue: 0, requiresPayment: false };
        }

        return {
            
            lockedCount: paywallInfo.lockedCount,
            totalAmountDue: paywallInfo.totalAmountDue,
            requiresPayment: true,
        };
    }


    /**
     * POST /reports/checkout
     *
     * Flow:
     * 1. Fetch top-10 properties matching the given filters (same dataset as summary/pdf)
     * 2. Run paywall logic — split into accessible vs locked
     * 3a. If quota NOT exhausted → return accessible list, no payment needed
     * 3b. If quota exhausted → create Stripe session for locked reports, return URL
     */
    async createCheckoutSession(
        userId: string,
        userRole: string,
        filters: {
            brandName?: string;
            color?: string;
            style?: string;
            search?: string;
            zip?: string;
            state_id?: string;
            city_id?: string;
        } = {},
    ): Promise<any> {
        // Sanitize filters: treat empty strings or whitespace-only strings as undefined
        const sanitizedFilters = {
            brandName: filters.brandName?.trim() || undefined,
            color: filters.color?.trim() || undefined,
            style: filters.style?.trim() || undefined,
            search: filters.search?.trim() || undefined,
            zip: filters.zip?.trim() || undefined,
            state_id: filters.state_id?.trim() || undefined,
            city_id: filters.city_id?.trim() || undefined,
        };

        const reportPriceDollars = await this.getReportPriceDollars();
        const reportPriceCents = await this.getReportPriceCents();

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const companyOwnerId = await this.getCompanyOwnerId(user);
        const subscription = await this.getActiveSubscription(companyOwnerId);

        // For PROPERTY_OWNER, we need to fetch ALL properties in top 10, not just owned ones
        let fetchUserRole = userRole;
        if (userRole === UserRole.PROPERTY_OWNER) {
            fetchUserRole = UserRole.ADMIN; // Use ADMIN role to fetch all properties
        }

        // Fetch top-10 filtered properties — same query as summary/pdf uses
        const { data: top10, total: totalMatchingProperties } = await this.propertiesService.getComponentSummaries(
            userId,
            fetchUserRole,
            undefined,                  // propertyId
            sanitizedFilters.brandName,
            sanitizedFilters.style,
            sanitizedFilters.color,
            sanitizedFilters.search,
            true,                       // has_report = true
            undefined,                  // propertyType
            sanitizedFilters.zip,
            1,                          // page
            10,                         // limit — top 10
            sanitizedFilters.state_id,
            sanitizedFilters.city_id,
        );
        
        if (top10.length === 0) {
            throw new BadRequestException('No reports found matching the given filters.');
        }

        // Run paywall logic on the fetched dataset
        const { accessibleIds, paywallInfo, noSubscription } =
            await this.computePaywallForProperties(userId, top10);

        if (noSubscription && userRole !== UserRole.PROPERTY_OWNER) {
            throw new BadRequestException('No active membership plan found. Please subscribe first.');
        }

        // Compute actual remaining quota from billing period usage
        let remainingQuota = 0;
        if (subscription) {
            if (this.hasUnlimitedReportAccess(subscription)) {
                remainingQuota = top10.length;
            } else if (subscription.plan.maxReports === 0) {
                remainingQuota = 0;
            } else {
                const { start, end } = this.getBillingPeriod(subscription);
                const usedInPeriod = await this.userReportUsageRepository
                    .createQueryBuilder('u')
                    .where('u.user_id = :userId', { userId })
                    .andWhere('u.subscription_id = :subId', { subId: subscription.id })
                    .andWhere('u.billing_period_start >= :start', { start })
                    .andWhere('u.billing_period_start <= :end', { end })
                    .getCount();
                remainingQuota = Math.max(0, subscription.plan.maxReports - usedInPeriod);
            }
        }

        // ── PROPERTY_OWNER SPECIAL LOGIC ──────────────────────────────────────────────────────────
        if (userRole === UserRole.PROPERTY_OWNER) {
            // Separate own properties (free) from others (paywall)
            const ownProperties = top10.filter(p => p.property_owner_id === userId);
            const otherProperties = top10.filter(p => p.property_owner_id !== userId);

            if (otherProperties.length === 0) {
                // Only own properties, no payment needed
                return {
                    requiresPayment: false,
                    remainingQuota,
                    totalMatchingProperties,
                    message: 'All properties in the top 10 are owned by you. No payment required. Call summary/pdf to download.',
                };
            }

            // Apply paywall logic only to other properties
            const { accessibleIds: otherAccessibleIds, paywallInfo: otherPaywallInfo } =
                await this.computePaywallForProperties(userId, otherProperties);

            const accessibleOtherProperties = otherProperties.filter(p => otherAccessibleIds.has(p.id));
            const lockedOtherProperties = otherProperties.filter(p => !otherAccessibleIds.has(p.id));
            
            if (lockedOtherProperties.length === 0) {
                // All other properties are accessible through subscription
                return {
                    requiresPayment: false,
                    remainingQuota,
                    totalMatchingProperties,
                    message: `You own ${ownProperties.length} properties and can access ${accessibleOtherProperties.length} others through your subscription. Call summary/pdf to download.`,
                };
            }

            // Need to pay for locked other properties only
            const reportPriceDollars = await this.getReportPriceDollars();
            const reportPriceCents = await this.getReportPriceCents();
            const totalAmount = lockedOtherProperties.length * reportPriceDollars;

            // Create Stripe checkout session for locked other properties only
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

            let stripeCustomerId: string | undefined = (await this.subscriptionRepository.findOne({
                where: { userId },
                order: { createdAt: 'DESC' },
            }))?.stripeCustomerId;

            if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
                const customer = await this.stripe.customers.create({
                    email: user.email,
                    name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || undefined,
                    address: { country: 'US' },
                    metadata: { userId },
                });
                stripeCustomerId = customer.id;
            } else {
                await this.stripe.customers.update(stripeCustomerId, { address: { country: 'US' } });
            }

            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'payment',
                customer: stripeCustomerId,
                locale: 'en',
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: `${lockedOtherProperties.length} Report${lockedOtherProperties.length > 1 ? 's' : ''} Access (Non-Owned Properties)` },
                        unit_amount: reportPriceCents,
                    },
                    quantity: lockedOtherProperties.length,
                }],
                success_url: `${frontendUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${frontendUrl}/purchase/cancel`,
                metadata: {
                    type: 'PROPERTY_OWNER_BULK_UNLOCK',
                    userId,
                    lockedReportIds: lockedOtherProperties.map(p => p.id).join(','),
                    ownPropertyIds: ownProperties.map(p => p.id).join(','),
                    accessibleReportIds: [...ownProperties, ...accessibleOtherProperties].map(p => p.id).join(','),
                    subscriptionId: subscription?.id ?? '',
                },
            });

            return {
                requiresPayment: true,
                lockedCount: lockedOtherProperties.length,
                totalAmountDue: lockedOtherProperties.length * reportPriceDollars,
                checkoutUrl: session.url!,
                totalMatchingProperties,
                message: `You own ${ownProperties.length} properties (free) and can access ${accessibleOtherProperties.length} others through subscription. Payment required for ${lockedOtherProperties.length} additional properties.`,
            };
        }
        // ──────────────────────────────────────────────────────────────────────────────────────────

        const accessible = top10.filter(p => accessibleIds.has(p.id));

        // ── Case A: quota not exhausted — no payment needed ──────────────────
        if (!paywallInfo || paywallInfo.lockedCount === 0) {
            return {
                requiresPayment: false,
                remainingQuota,
                totalMatchingProperties,
                message: 'You can access these reports within your membership plan. Call summary/pdf to download.',
            };
        }

        // ── Case B: quota exhausted — need payment ───────────────────────────
        const locked = top10.filter(p => !accessibleIds.has(p.id));

        // Create Stripe checkout session
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        let stripeCustomerId: string | undefined = (await this.subscriptionRepository.findOne({
            where: { userId: companyOwnerId },
            order: { createdAt: 'DESC' },
        }))?.stripeCustomerId;

        // Validate stripeCustomerId — must be a real Stripe customer ID (starts with 'cus_').
        // Free/manual subscriptions may store a placeholder like 'free' which is invalid for Stripe.
        if (!stripeCustomerId || !stripeCustomerId.startsWith('cus_')) {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || undefined,
                address: { country: 'US' },
                metadata: { userId },
            });
            stripeCustomerId = customer.id;
        } else {
            await this.stripe.customers.update(stripeCustomerId, { address: { country: 'US' } });
        }

        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer: stripeCustomerId,
            locale: 'en',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: `${locked.length} Report${locked.length > 1 ? 's' : ''} Access` },
                    unit_amount: reportPriceCents,
                },
                quantity: locked.length,
            }],
            success_url: `${frontendUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/purchase/cancel`,
            metadata: {
                type: 'REPORT_BULK_UNLOCK',
                userId,
                lockedReportIds: locked.map(p => p.id).join(','),
                accessibleReportIds: accessible.map(p => p.id).join(','),
                subscriptionId: subscription?.id ?? '',
            },
        });

        return {
            requiresPayment: true,
            lockedCount: locked.length,
            totalAmountDue: locked.length * reportPriceDollars,
            checkoutUrl: session.url!,
           
            totalMatchingProperties,
        };
    }
}
