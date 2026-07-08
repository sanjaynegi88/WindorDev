import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { StripeConfigService } from './stripe-config.service';
import { Subscription as SubscriptionEntity } from '../entities/subscription.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { User } from '../entities/user.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { UserPurchase } from '../entities/user-purchase.entity';
import { NotificationType } from '../entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import Stripe from 'stripe';
@Injectable()
export class StripeService {
    private stripe: Stripe;

    constructor(
        private stripeConfig: StripeConfigService,
        @InjectRepository(SubscriptionEntity)
        private subscriptionRepository: Repository<SubscriptionEntity>,
        @InjectRepository(UserProfile)
        private userProfileRepository: Repository<UserProfile>,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserReportUsage)
        private userReportUsageRepository: Repository<UserReportUsage>,
        @InjectRepository(ReportPurchase)
        private reportPurchaseRepository: Repository<ReportPurchase>,
        @InjectRepository(UserPurchase)
        private userPurchaseRepository: Repository<UserPurchase>,
        private notificationsService: NotificationsService,
        private appSettingsService: AppSettingsService,
    ) {
        this.stripe = this.stripeConfig.getStripe();
    }

    private async getReportPriceDollars(): Promise<number> {
        const val = await this.appSettingsService.getValue('report_price', '69.00');
        return parseFloat(val);
    }

    private sanitizeForLog(input: any, maxLength: number = 100): string {
        if (!input) return 'unknown';
        
        // Convert to string and apply strict sanitization
        const sanitized = String(input)
            // Remove all control characters including newlines, tabs, etc.
            .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
            // Remove any remaining non-printable characters
            .replace(/[^\x20-\x7E]/g, '')
            // Limit length to prevent log flooding
            .substring(0, maxLength)
            // Trim whitespace
            .trim();
            
        return sanitized || 'sanitized';
    }

    private logSecurely(level: 'info' | 'error', message: string, data?: Record<string, any>): void {
        const logData = {
            message,
            timestamp: new Date().toISOString(),
            service: 'StripeService',
            ...(data && Object.keys(data).reduce((acc, key) => {
                acc[key] = this.sanitizeForLog(data[key], 200);
                return acc;
            }, {} as Record<string, string>))
        };
        
        if (level === 'error') {
            console.error(JSON.stringify(logData));
        } else {
            console.log(JSON.stringify(logData));
        }
    }

    async handleWebhook(body: any, signature: string): Promise<void> {
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(
                body,
                signature,
                this.stripeConfig.getWebhookSecret()
            );
        } catch (err) {
            this.logSecurely('error', 'Webhook signature verification failed', {
                error: err.message,
                errorType: err.constructor.name
            });
            throw new Error('Webhook signature verification failed');
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                    break;
                    
                case 'invoice.payment_succeeded':
                    await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
                    break;
                    
                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                    break;
                    
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                    break;
                    
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                    break;
                    
                default:
                    break;
            }
        } catch (error) {
            throw error;
        }
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
        // ── REPORT BULK UNLOCK ────────────────────────────────────────────────
        if (session.metadata?.type === 'REPORT_BULK_UNLOCK' || session.metadata?.type === 'PROPERTY_OWNER_BULK_UNLOCK') {
            await this.handleReportBulkUnlock(session);
            return;
        }

        // ── ADDITIONAL USERS PURCHASE ────────────────────────────────────────
        if (session.metadata?.type === 'ADDITIONAL_USERS') {
            await this.handleAdditionalUsersPurchase(session);
            return;
        }

        // ── REACTIVATE USERS PURCHASE ────────────────────────────────────────
        if (session.metadata?.type === 'REACTIVATE_USERS') {
            await this.handleReactivateUsersPurchase(session);
            return;
        }
        // ─────────────────────────────────────────────────────────────────────

        const dbSubscriptionId =
            session.client_reference_id ||
            session.metadata?.subscriptionId;

        if (!dbSubscriptionId) {
            return;
        }

        const updateResult = await this.subscriptionRepository.update(
            { id: dbSubscriptionId },
            {
                status: 'ACTIVE',
                stripeSubscriptionId: session.subscription as string,
            }
        );

        if (!updateResult.affected) {
            return;
        }

        const subscription = await this.subscriptionRepository.findOne({
            where: { id: dbSubscriptionId },
            relations: ['user', 'plan']
        });

        if (subscription) {
            await this.userProfileRepository.update(
                { user_id: subscription.userId },
                {
                    current_subscription_id: subscription.id,
                    has_membership: true
                }
            );

            // Send membership purchase notifications
            try {
                await this.notificationsService.notifyMembershipPurchased(
                    subscription.userId,
                    subscription.plan.name,
                    subscription.user.role ?? '',
                    subscription.user.email
                );
            } catch (error) {
                this.logSecurely('error', 'Failed to send membership purchase notifications', {
                    subscriptionId: dbSubscriptionId,
                    userId: subscription.userId,
                    error: error.message
                });
            }
        }
    }

    private async handleReportBulkUnlock(session: Stripe.Checkout.Session): Promise<void> {
        const userId = session.metadata?.userId;
        const lockedReportIdsRaw = session.metadata?.lockedReportIds;
        const accessibleReportIdsRaw = session.metadata?.accessibleReportIds;
        const ownPropertyIdsRaw = session.metadata?.ownPropertyIds; // For PROPERTY_OWNER_BULK_UNLOCK
        const subscriptionId = session.metadata?.subscriptionId || null;
        const paymentIntentId = session.payment_intent as string | null;
        const paymentType = session.metadata?.type;

        console.log(`[WEBHOOK] handleReportBulkUnlock called for ${paymentType}`);
        console.log(`[WEBHOOK] userId: ${userId}`);
        console.log(`[WEBHOOK] lockedReportIds: ${lockedReportIdsRaw}`);
        console.log(`[WEBHOOK] accessibleReportIds: ${accessibleReportIdsRaw}`);
        console.log(`[WEBHOOK] ownPropertyIds: ${ownPropertyIdsRaw}`);
        console.log(`[WEBHOOK] subscriptionId: ${subscriptionId}`);

        if (!userId || !lockedReportIdsRaw) {
            console.log(`[WEBHOOK] Missing required metadata - userId: ${!!userId}, lockedReportIds: ${!!lockedReportIdsRaw}`);
            this.logSecurely('error', 'REPORT_BULK_UNLOCK missing metadata', {
                sessionId: session.id,
            });
            return;
        }

        const reportPriceDollars = await this.getReportPriceDollars();
        console.log(`[WEBHOOK] Report price: $${reportPriceDollars}`);

        const lockedIds = lockedReportIdsRaw.split(',').filter(Boolean);
        const accessibleIds = accessibleReportIdsRaw ? accessibleReportIdsRaw.split(',').filter(Boolean) : [];
        const ownPropertyIds = ownPropertyIdsRaw ? ownPropertyIdsRaw.split(',').filter(Boolean) : [];

        console.log(`[WEBHOOK] Parsed IDs:`);
        console.log(`[WEBHOOK] - Locked: ${lockedIds.length} properties [${lockedIds.join(', ')}]`);
        console.log(`[WEBHOOK] - Accessible: ${accessibleIds.length} properties [${accessibleIds.join(', ')}]`);
        console.log(`[WEBHOOK] - Own: ${ownPropertyIds.length} properties [${ownPropertyIds.join(', ')}]`);

        if (lockedIds.length === 0 && accessibleIds.length === 0) {
            console.log(`[WEBHOOK] No properties to process - returning`);
            return;
        }

        // Resolve billing period from subscription if available
        let billingStart: Date = new Date();
        let billingEnd: Date = new Date();
        let resolvedSubscriptionId: string | null = subscriptionId || null;

        if (subscriptionId) {
            const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
            if (subscription) {
                const end = new Date(subscription.currentPeriodEnd);
                const createdAt = new Date(subscription.createdAt);
                const periodStart = new Date(end);
                periodStart.setMonth(periodStart.getMonth() - (subscription.billingCycle === 'monthly' ? 1 : 12));
                billingStart = createdAt > periodStart ? createdAt : periodStart;
                billingEnd = end;
                console.log(`[WEBHOOK] Billing period: ${billingStart.toISOString()} to ${billingEnd.toISOString()}`);
            } else {
                console.log(`[WEBHOOK] Subscription ${subscriptionId} not found`);
            }
        } else {
            console.log(`[WEBHOOK] No subscription ID provided`);
        }

        // Save paid usage records for locked reports
        console.log(`[WEBHOOK] Processing ${lockedIds.length} locked reports for payment`);
        for (const reportId of lockedIds) {
            try {
                const usageRecord = await this.userReportUsageRepository.save(
                    this.userReportUsageRepository.create({
                        userId,
                        subscriptionId: resolvedSubscriptionId,
                        reportId,
                        billingPeriodStart: billingStart,
                        billingPeriodEnd: billingEnd,
                        isFree: false,
                        priceCharged: reportPriceDollars,
                        paymentIntentId,
                    })
                );
                console.log(`[WEBHOOK] ✅ Created paid usage record for report ${reportId}`);
            } catch (error) {
                console.log(`[WEBHOOK] ⚠️ Failed to create usage record for report ${reportId}: ${error.message}`);
                // Unique constraint violation — already unlocked, skip
            }
        }

        // Save quota usage records for accessible (free-via-membership) reports
        // so they show as is_purchased=true in the summary API
        console.log(`[WEBHOOK] Processing ${accessibleIds.length} accessible reports for quota tracking`);
        for (const reportId of accessibleIds) {
            try {
                const usageRecord = await this.userReportUsageRepository.save(
                    this.userReportUsageRepository.create({
                        userId,
                        subscriptionId: resolvedSubscriptionId,
                        reportId,
                        billingPeriodStart: billingStart,
                        billingPeriodEnd: billingEnd,
                        isFree: true,
                        priceCharged: 0,
                        paymentIntentId: null,
                    })
                );
                console.log(`[WEBHOOK] ✅ Created free usage record for report ${reportId}`);
            } catch (error) {
                console.log(`[WEBHOOK] ⚠️ Failed to create usage record for report ${reportId}: ${error.message}`);
                // Unique constraint violation — already recorded, skip
            }
        }

        // For PROPERTY_OWNER_BULK_UNLOCK, also create free usage records for owned properties
        if (paymentType === 'PROPERTY_OWNER_BULK_UNLOCK' && ownPropertyIds.length > 0) {
            console.log(`[WEBHOOK] Processing ${ownPropertyIds.length} owned properties for free access`);
            for (const reportId of ownPropertyIds) {
                try {
                    const usageRecord = await this.userReportUsageRepository.save(
                        this.userReportUsageRepository.create({
                            userId,
                            subscriptionId: resolvedSubscriptionId,
                            reportId,
                            billingPeriodStart: billingStart,
                            billingPeriodEnd: billingEnd,
                            isFree: true,
                            priceCharged: 0,
                            paymentIntentId: null,
                        })
                    );
                    console.log(`[WEBHOOK] ✅ Created free usage record for owned property ${reportId}`);
                } catch (error) {
                    console.log(`[WEBHOOK] ⚠️ Failed to create usage record for owned property ${reportId}: ${error.message}`);
                    // Unique constraint violation — already recorded, skip
                }
            }
        }

        console.log(`[WEBHOOK] REPORT_BULK_UNLOCK completed successfully`);
        this.logSecurely('info', 'REPORT_BULK_UNLOCK completed', {
            userId,
            unlockedCount: String(lockedIds.length),
            accessibleCount: String(accessibleIds.length),
            ownPropertiesCount: String(ownPropertyIds.length),
            paymentType,
            sessionId: session.id,
        });
    }

    private async handleAdditionalUsersPurchase(session: Stripe.Checkout.Session): Promise<void> {
        const userPurchaseId = session.metadata?.userPurchaseId;
        const userId = session.metadata?.userId;
        const numberOfUsers = session.metadata?.numberOfUsers;

        if (!userPurchaseId || !userId) {
            this.logSecurely('error', 'ADDITIONAL_USERS missing metadata', {
                sessionId: session.id,
                userPurchaseId: userPurchaseId || 'missing',
                userId: userId || 'missing'
            });
            return;
        }

        try {
            // Update user purchase record to completed
            await this.userPurchaseRepository.update(
                { id: userPurchaseId },
                {
                    status: 'completed',
                    paymentIntentId: session.payment_intent as string,
                    completedAt: new Date()
                }
            );

            // Send notification for successful purchase
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user) {
                try {
                    await this.notificationsService.create({
                        recipientUserId: userId,
                        type: NotificationType.ADDITIONAL_USERS_PURCHASED,
                        title: 'Additional Users Purchased Successfully',
                        message: `You have successfully purchased ${numberOfUsers} additional staff member seat(s).`,
                        metadata: { relatedId: userPurchaseId, numberOfUsers, totalAmount: session.amount_total }
                    });
                } catch (notificationError) {
                    this.logSecurely('error', 'Failed to send purchase notification', {
                        userId,
                        userPurchaseId,
                        error: notificationError.message
                    });
                }
            }

            console.log(`[WEBHOOK] ✅ ADDITIONAL_USERS purchase completed for user ${userId}`);
            this.logSecurely('info', 'ADDITIONAL_USERS purchase completed', {
                userId,
                userPurchaseId,
                numberOfUsers,
                sessionId: session.id,
                amount: String(session.amount_total)
            });
        } catch (error) {
            this.logSecurely('error', 'Failed to process ADDITIONAL_USERS purchase', {
                userId,
                userPurchaseId,
                sessionId: session.id,
                error: error.message
            });
            throw error;
        }
    }

    private async handleReactivateUsersPurchase(session: Stripe.Checkout.Session): Promise<void> {
        const userPurchaseId = session.metadata?.userPurchaseId;
        const userId = session.metadata?.userId;
        const numberOfUsers = session.metadata?.numberOfUsers;
        const reactivateUserIdsStr = session.metadata?.reactivateUserIds;

        if (!userPurchaseId || !userId || !reactivateUserIdsStr) {
            this.logSecurely('error', 'REACTIVATE_USERS missing metadata', {
                sessionId: session.id,
                userPurchaseId: userPurchaseId || 'missing',
                userId: userId || 'missing'
            });
            return;
        }

        try {
            const reactivateUserIds = reactivateUserIdsStr.split(',').filter(Boolean);

            // Update user purchase record to completed
            await this.userPurchaseRepository.update(
                { id: userPurchaseId },
                {
                    status: 'completed',
                    paymentIntentId: session.payment_intent as string,
                    completedAt: new Date()
                }
            );

            // Reactivate the users
            await this.userRepository.update(
                { id: In(reactivateUserIds), parent_id: userId, sub_account: true },
                { is_active: true }
            );

            console.log(`[WEBHOOK] ✅ REACTIVATE_USERS purchase completed for user ${userId}`);
            this.logSecurely('info', 'REACTIVATE_USERS purchase completed', {
                userId,
                userPurchaseId,
                numberOfUsers,
                sessionId: session.id,
                amount: String(session.amount_total)
            });
        } catch (error) {
            this.logSecurely('error', 'Failed to process REACTIVATE_USERS purchase', {
                userId,
                userPurchaseId,
                sessionId: session.id,
                error: error.message
            });
            throw error;
        }
    }

    private async handleInvoicePaymentSucceeded(invoice: any): Promise<void> {
        if (!invoice.subscription) return;

        const updateResult = await this.subscriptionRepository.update(
            { stripeCustomerId: invoice.customer as string },
            {
                status: 'ACTIVE',
                stripeSubscriptionId: invoice.subscription as string,
            }
        );

        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeSubscriptionId: invoice.subscription as string },
            relations: ['user', 'plan']
        });

        if (subscription) {
            const wasInactive = !subscription.status || subscription.status !== 'ACTIVE';
            
            await this.userProfileRepository.update(
                { user_id: subscription.userId },
                {
                    current_subscription_id: subscription.id,
                    has_membership: true
                }
            );

            // Send notifications only for new activations or reactivations
            if (wasInactive) {
                try {
                    await this.notificationsService.notifyMembershipPurchased(
                        subscription.userId,
                        subscription.plan.name,
                        subscription.user.role ?? '',
                        subscription.user.email
                    );
                } catch (error) {
                    this.logSecurely('error', 'Failed to send membership reactivation notifications', {
                        subscriptionId: subscription.id,
                        userId: subscription.userId,
                        error: error.message
                    });
                }
            }
        }
    }

    private async handleInvoicePaymentFailed(invoice: any): Promise<void> {
        if (!invoice.subscription) return;

        const stripeSubscriptionId = invoice.subscription as string;
        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeSubscriptionId }
        });

        if (subscription) {
            subscription.status = 'GRACE_PERIOD';
            // Set grace period to 2 days from now
            const gracePeriod = new Date();
            gracePeriod.setDate(gracePeriod.getDate() + 2);
            subscription.gracePeriodEndsAt = gracePeriod;
            await this.subscriptionRepository.save(subscription);
            
            // Note: We don't revoke has_membership yet, that happens in deleted event or after grace period checks
        }
    }

    private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeSubscriptionId: stripeSubscription.id }
        });

        if (subscription) {
            subscription.status = 'SUSPENDED';
            await this.subscriptionRepository.save(subscription);

            // Clear current subscription ID and revoke membership
            await this.userProfileRepository.update(
                { user_id: subscription.userId },
                { 
                    current_subscription_id: null,
                    has_membership: false
                }
            );

            // Disable all sub-users
            await this.userRepository.update(
                { parent_id: subscription.userId, sub_account: true },
                { is_active: false }
            );
        }
    }

    private async handleSubscriptionUpdated(stripeSubscription: any): Promise<void> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeSubscriptionId: stripeSubscription.id },
            relations: ['user', 'plan']
        });

        if (subscription) {
            const oldStatus = subscription.status;
            
            // Safely handle timestamp conversion
            const currentPeriodEnd = stripeSubscription.current_period_end;
            if (currentPeriodEnd && !isNaN(currentPeriodEnd)) {
                subscription.currentPeriodEnd = new Date(currentPeriodEnd * 1000);
            }
            
            // Sync status if it changed in Stripe (e.g., past_due, canceled)
            if (stripeSubscription.status === 'active') {
                subscription.status = 'ACTIVE';
                // Update user profile with membership
                await this.userProfileRepository.update(
                    { user_id: subscription.userId },
                    { 
                        current_subscription_id: subscription.id,
                        has_membership: true
                    }
                );

                // Send notification if subscription was reactivated
                if (oldStatus !== 'ACTIVE') {
                    try {
                        await this.notificationsService.notifyMembershipPurchased(
                            subscription.userId,
                            subscription.plan.name,
                            subscription.user.role ?? '',
                            subscription.user.email
                        );
                    } catch (error) {
                        this.logSecurely('error', 'Failed to send membership reactivation notifications', {
                            subscriptionId: subscription.id,
                            userId: subscription.userId,
                            error: error.message
                        });
                    }
                }
            } else if (stripeSubscription.status === 'past_due' || stripeSubscription.status === 'unpaid') {
                subscription.status = 'GRACE_PERIOD';
                // Keep membership during grace period
            } else if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'incomplete_expired') {
                subscription.status = 'SUSPENDED';
                // Revoke membership
                await this.userProfileRepository.update(
                    { user_id: subscription.userId },
                    { 
                        current_subscription_id: null,
                        has_membership: false
                    }
                );
                // Disable all sub-users
                await this.userRepository.update(
                    { parent_id: subscription.userId, sub_account: true },
                    { is_active: false }
                );
            }

            await this.subscriptionRepository.save(subscription);
        }
    }



    async createPaymentSession(subscriptionId: string): Promise<Stripe.Checkout.Session> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { id: subscriptionId },
            relations: ['plan']
        });

        if (!subscription) {
            throw new Error('Subscription not found');
        }

        const priceId = subscription.billingCycle === 'monthly' 
            ? subscription.plan.monthlyPriceId 
            : subscription.plan.annualyPriceId;
        
        if (!priceId) {
            throw new Error(`${subscription.billingCycle} billing is not available for this plan`);
        }
        
        // Use environment variables for URLs
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/subscription/success`;
        const cancelUrl = `${frontendUrl}/subscription/cancel`;

        return await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: subscription.stripeCustomerId,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                subscriptionId: subscription.id,
                planId: subscription.planId,
                billingCycle: subscription.billingCycle,
                userId: subscription.userId
            }
        });
    }

    async confirmPayment(sessionId: string): Promise<any> {
        // Retrieve checkout session from Stripe
        const session = await this.stripe.checkout.sessions.retrieve(sessionId);

        // Verify payment actually succeeded
        if (session.payment_status !== 'paid') {
            throw new Error('Payment not completed');
        }

        const reportPriceDollars = await this.getReportPriceDollars();

        // Determine payment type first — report unlocks must bypass the
        // membership "already active" guard below, which would otherwise
        // short-circuit them because the user's membership subscription IS active.
        const paymentType = session.metadata?.type;

        // BULK REPORT PURCHASE (including PROPERTY_OWNER_BULK_UNLOCK)
        if (paymentType === 'REPORT_BULK_UNLOCK' || paymentType === 'PROPERTY_OWNER_BULK_UNLOCK') {
            await this.handleReportBulkUnlock(session);
            return {
                success: true,
                type: 'bulk_reports',
                message: 'Bulk reports unlocked successfully'
            };
        }

        // SINGLE REPORT PURCHASE
        if (paymentType === 'SINGLE_REPORT_UNLOCK') {
            await this.handleSingleReportUnlock(session);
            return {
                success: true,
                type: 'single_report',
                message: 'Report unlocked successfully'
            };
        }

        // ADDITIONAL USERS PURCHASE
        if (paymentType === 'ADDITIONAL_USERS') {
            await this.handleAdditionalUsersPurchase(session);
            return {
                success: true,
                type: 'additional_users',
                message: 'Additional users purchased successfully'
            };
        }

        // REACTIVATE USERS PURCHASE
        if (paymentType === 'REACTIVATE_USERS') {
            await this.handleReactivateUsersPurchase(session);
            return {
                success: true,
                type: 'reactivate_users',
                message: 'Users reactivated successfully'
            };
        }

        // DEFAULT = MEMBERSHIP SUBSCRIPTION
        // Get subscription ID from metadata
        const dbSubscriptionId =
            session.client_reference_id ||
            session.metadata?.subscriptionId;

        if (!dbSubscriptionId) {
            throw new Error('Subscription ID missing');
        }

        // Prevent duplicate activation for membership payments
        const existingSubscription = await this.subscriptionRepository.findOne({
            where: { id: dbSubscriptionId }
        });

        // Already activated
        if (existingSubscription?.status === 'ACTIVE') {
            return {
                success: true,
                message: 'Subscription already active'
            };
        }

        await this.handleCheckoutSessionCompleted(session);
        return {
            success: true,
            type: 'membership',
            message: 'Membership activated successfully'
        };
    }

    private async handleSingleReportUnlock(session: Stripe.Checkout.Session): Promise<void> {
        const userId = session.metadata?.userId;
        const reportId = session.metadata?.propertyId;   // propertyId stored in metadata
        const subscriptionId = session.metadata?.subscriptionId || null;
        const paymentIntentId = session.payment_intent as string | null;

        if (!userId || !reportId) {
            this.logSecurely('error', 'SINGLE_REPORT_UNLOCK missing metadata', {
                sessionId: session.id,
            });
            return;
        }

        const reportPriceDollars = await this.getReportPriceDollars();

        // Resolve billing period from subscription if available
        let billingStart: Date = new Date();
        let billingEnd: Date = new Date();
        let resolvedSubscriptionId: string | null = subscriptionId || null;

        if (subscriptionId) {
            const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId } });
            if (subscription) {
                const end = new Date(subscription.currentPeriodEnd);
                const createdAt = new Date(subscription.createdAt);
                const periodStart = new Date(end);
                periodStart.setMonth(periodStart.getMonth() - (subscription.billingCycle === 'monthly' ? 1 : 12));
                billingStart = createdAt > periodStart ? createdAt : periodStart;
                billingEnd = end;
            }
        }

        // Create the ReportPurchase record now that payment is confirmed
        try {
            await this.reportPurchaseRepository.save(
                this.reportPurchaseRepository.create({
                    propertyId: reportId,
                    purchasedByUserId: userId,
                    amountPaid: reportPriceDollars,
                    purchaseType: 'one_time',
                    paymentIntentId,
                    metadata: { stripeSessionId: session.id },
                })
            );
        } catch (_) {
            // Unique constraint — already recorded, skip
        }

        // Save usage record so the report is immediately accessible
        try {
            await this.userReportUsageRepository.save(
                this.userReportUsageRepository.create({
                    userId,
                    subscriptionId: resolvedSubscriptionId,
                    reportId,
                    billingPeriodStart: billingStart,
                    billingPeriodEnd: billingEnd,
                    isFree: false,
                    priceCharged: reportPriceDollars,
                    paymentIntentId,
                })
            );
        } catch (_) {
            // Unique constraint violation — already unlocked, skip
        }

        this.logSecurely('info', 'SINGLE_REPORT_UNLOCK completed', {
            userId,
            reportId,
            sessionId: session.id,
        });
    }
}