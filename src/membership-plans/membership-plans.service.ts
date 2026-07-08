import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { MembershipPlan, Level } from '../entities/membership-plan.entity';
import { Subscription as SubscriptionEntity } from '../entities/subscription.entity';
import { UserPurchase } from '../entities/user-purchase.entity';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { PurchaseAdditionalUsersDto } from './dto/purchase-additional-users.dto';
import { ReactivateUsersDto } from './dto/reactivate-users.dto';
import { User, UserRole } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { ContractorDirectoryProfile } from '../entities/contractor-directory-profile.entity';
import { StripePriceService } from '../stripe/stripe-price.service';
import { StripeConfigService } from '../stripe/stripe-config.service';
import { AppSettingsService } from '../app-settings/app-settings.service';
import Stripe from 'stripe';

@Injectable()
export class MembershipPlansService {
    private stripe: Stripe;

    constructor(
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(SubscriptionEntity)
        private subscriptionRepository: Repository<SubscriptionEntity>,
        @InjectRepository(UserPurchase)
        private userPurchaseRepository: Repository<UserPurchase>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserProfile)
        private userProfileRepository: Repository<UserProfile>,
        @InjectRepository(ContractorDirectoryProfile)
        private contractorDirectoryRepository: Repository<ContractorDirectoryProfile>,
        private stripePriceService: StripePriceService,
        private stripeConfig: StripeConfigService,
        private appSettingsService: AppSettingsService,
    ) {
        this.stripe = this.stripeConfig.getStripe();
    }

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    async create(createMembershipPlanDto: CreateMembershipPlanDto, userRole: string): Promise<MembershipPlan> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can create membership plans');
        }

        // Check if membership plan name already exists
        const existingPlan = await this.membershipPlanRepository.findOne({
            where: { name: createMembershipPlanDto.name }
        });

        if (existingPlan) {
            throw new BadRequestException('Membership plan with this name already exists');
        }

        // Prevent duplicate plans for the same role/level combination
        const targetRole = createMembershipPlanDto.targetRole || UserRole.CONTRACTOR;
        const targetLevel = createMembershipPlanDto.level;
        const duplicatePlan = await this.membershipPlanRepository.findOne({
            where: targetLevel !== undefined
                ? { targetRole, level: targetLevel }
                : { targetRole, level: IsNull() }
        });

        if (duplicatePlan) {
            throw new BadRequestException(
                `A membership plan already exists for targetRole=${targetRole} and level=${targetLevel ?? 'none'}.`
            );
        }

        // Validate level is only FREE or STANDARD for PROPERTY_OWNER plans
        if (targetRole === UserRole.PROPERTY_OWNER && createMembershipPlanDto.level) {
            const allowedOwnerLevels = [Level.FREE, Level.STANDARD];
            if (!allowedOwnerLevels.includes(createMembershipPlanDto.level)) {
                throw new BadRequestException(
                    `Property owner membership plans only support level FREE or STANDARD. Received: ${createMembershipPlanDto.level}`
                );
            }
        }

        // For CONTRACTOR and MANUFACTURER, only FREE, STANDARD, SILVER, GOLD are allowed
        if ((targetRole === UserRole.CONTRACTOR || targetRole === UserRole.MANUFACTURER) && createMembershipPlanDto.level) {
            const allowedContractorLevels = [Level.FREE, Level.STANDARD, Level.SILVER, Level.GOLD];
            if (!allowedContractorLevels.includes(createMembershipPlanDto.level)) {
                throw new BadRequestException(
                    `Membership plans for ${targetRole} only support levels: ${allowedContractorLevels.join(', ')}. Received: ${createMembershipPlanDto.level}`
                );
            }
        }

        // Skip Stripe price creation for free plans ($0)
        let monthlyPriceId: string | null = null;
        let annualyPriceId: string | null = null;
        
        if ((createMembershipPlanDto.monthlyAmount && createMembershipPlanDto.monthlyAmount > 0) || 
            (createMembershipPlanDto.yearlyAmount && createMembershipPlanDto.yearlyAmount > 0)) {
            const stripeData = await this.stripePriceService.createStripeProductAndPrices({
                name: createMembershipPlanDto.name,
                description: createMembershipPlanDto.description || '',
                monthlyAmount: Math.round((createMembershipPlanDto.monthlyAmount || 0) * 100),
                yearlyAmount: Math.round((createMembershipPlanDto.yearlyAmount || 0) * 100),
                features: createMembershipPlanDto.features
            });
            monthlyPriceId = stripeData.monthlyPriceId;
            annualyPriceId = stripeData.annualyPriceId;
        }

        // Create the membership plan with generated Stripe IDs
        const membershipPlanData: Partial<MembershipPlan> = {
            name: createMembershipPlanDto.name,
            description: createMembershipPlanDto.description,
            monthlyAmount: createMembershipPlanDto.monthlyAmount,
            yearlyAmount: createMembershipPlanDto.yearlyAmount,
            features: createMembershipPlanDto.features,
            isActive: createMembershipPlanDto.isActive ?? true,
            monthlyPriceId: monthlyPriceId,
            annualyPriceId: annualyPriceId,
            targetRole: createMembershipPlanDto.targetRole || UserRole.CONTRACTOR,
            level: createMembershipPlanDto.level,
            maxCities: createMembershipPlanDto.maxCities ?? 0,
            maxReports: createMembershipPlanDto.maxReports ?? 0,
            maxProperties: createMembershipPlanDto.maxProperties ?? 0,
            maxProjects: createMembershipPlanDto.maxProjects ?? 0,
            isUnlimitedProperties: createMembershipPlanDto.isUnlimitedProperties ?? false,
            isUnlimitedProjects: createMembershipPlanDto.isUnlimitedProjects ?? false,
            maxUsers: createMembershipPlanDto.maxUsers ?? 0,
            isUnlimitedAccess: createMembershipPlanDto.isUnlimitedAccess ?? false,
        };

        const membershipPlan = this.membershipPlanRepository.create(membershipPlanData);
        return await this.membershipPlanRepository.save(membershipPlan);
    }

    async findAll(userRole: string, targetRole?: string): Promise<MembershipPlan[]> {
        const where: any = {};
        if (userRole !== UserRole.ADMIN) {
            where.isActive = true;
            where.targetRole = userRole;
        } else if (targetRole) {
            where.targetRole = targetRole;
        }

        const plans = await this.membershipPlanRepository.find({
            where,
            order: { createdAt: 'DESC' }
        });

        const levelOrder: Record<string, number> = {
            'FREE': 1,
            'STANDARD': 2,
            'SILVER': 3,
            'GOLD': 4
        };

        return plans.sort((a, b) => {
            const orderA = a.level ? (levelOrder[a.level] || 99) : 99;
            const orderB = b.level ? (levelOrder[b.level] || 99) : 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
        });
    }

    async findOne(id: string): Promise<MembershipPlan> {
        const membershipPlan = await this.membershipPlanRepository.findOne({
            where: { id }
        });

        if (!membershipPlan) {
            throw new NotFoundException(`Membership plan with ID ${id} not found`);
        }

        return membershipPlan;
    }

    async update(id: string, updateMembershipPlanDto: UpdateMembershipPlanDto, userRole: string): Promise<MembershipPlan> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can update membership plans');
        }

        const membershipPlan = await this.findOne(id);

        // Check if new membership plan name already exists (if name is being updated)
        if (updateMembershipPlanDto.name && updateMembershipPlanDto.name !== membershipPlan.name) {
            const existingPlan = await this.membershipPlanRepository.findOne({
                where: { name: updateMembershipPlanDto.name }
            });

            if (existingPlan) {
                throw new BadRequestException('Membership plan with this name already exists');
            }
        }

        // Validate level is only FREE or STANDARD for PROPERTY_OWNER plans
        const effectiveRole = updateMembershipPlanDto.targetRole ?? membershipPlan.targetRole;
        const effectiveLevel = updateMembershipPlanDto.level ?? membershipPlan.level;
        if (effectiveRole === UserRole.PROPERTY_OWNER && effectiveLevel) {
            const allowedOwnerLevels = [Level.FREE, Level.STANDARD];
            if (!allowedOwnerLevels.includes(effectiveLevel)) {
                throw new BadRequestException(
                    `Property owner membership plans only support level FREE or STANDARD. Received: ${effectiveLevel}`
                );
            }
        }

        // For CONTRACTOR and MANUFACTURER, only FREE, STANDARD, SILVER, GOLD are allowed
        if ((effectiveRole === UserRole.CONTRACTOR || effectiveRole === UserRole.MANUFACTURER) && effectiveLevel) {
            const allowedContractorLevels = [Level.FREE, Level.STANDARD, Level.SILVER, Level.GOLD];
            if (!allowedContractorLevels.includes(effectiveLevel)) {
                throw new BadRequestException(
                    `Membership plans for ${effectiveRole} only support levels: ${allowedContractorLevels.join(', ')}. Received: ${effectiveLevel}`
                );
            }
        }

        // Check if price amounts are being updated
        const oldMonthly = membershipPlan.monthlyAmount ? parseFloat(membershipPlan.monthlyAmount.toString()) : null;
        const newMonthly = updateMembershipPlanDto.monthlyAmount !== undefined ? parseFloat(updateMembershipPlanDto.monthlyAmount.toString()) : oldMonthly;
        
        const oldYearly = membershipPlan.yearlyAmount ? parseFloat(membershipPlan.yearlyAmount.toString()) : null;
        const newYearly = updateMembershipPlanDto.yearlyAmount !== undefined ? parseFloat(updateMembershipPlanDto.yearlyAmount.toString()) : oldYearly;

        const priceChanged = 
            (newMonthly !== oldMonthly) ||
            (newYearly !== oldYearly);

        let updatedData: any = { ...updateMembershipPlanDto };

        // Remove brand_id if present (not a DB column)
        delete updatedData.brand_id;

        if (priceChanged) {
            // Create new Stripe prices
            const newPrices = await this.stripePriceService.createStripeProductAndPrices({
                name: updateMembershipPlanDto.name || membershipPlan.name,
                description: updateMembershipPlanDto.description || membershipPlan.description,
                monthlyAmount: Math.round((updateMembershipPlanDto.monthlyAmount || membershipPlan.monthlyAmount || 0) * 100),
                yearlyAmount: Math.round((updateMembershipPlanDto.yearlyAmount || membershipPlan.yearlyAmount || 0) * 100),
                features: updateMembershipPlanDto.features || membershipPlan.features
            });

            // Deactivate old prices (only if they exist)
            if (membershipPlan.monthlyPriceId) {
                await this.stripePriceService.deactivatePrice(membershipPlan.monthlyPriceId);
            }
            if (membershipPlan.annualyPriceId) {
                await this.stripePriceService.deactivatePrice(membershipPlan.annualyPriceId);
            }

            // Update with new price IDs
            updatedData.monthlyPriceId = newPrices.monthlyPriceId;
            updatedData.annualyPriceId = newPrices.annualyPriceId;

        }

        await this.membershipPlanRepository.update(id, updatedData);
        const updatedPlan = await this.findOne(id);
        
        return {
            ...updatedPlan,
            monthlyAmount: updatedPlan.monthlyAmount ? parseFloat(updatedPlan.monthlyAmount.toString()) : null,
            yearlyAmount: updatedPlan.yearlyAmount ? parseFloat(updatedPlan.yearlyAmount.toString()) : null
        };
    }

    async remove(id: string, userRole: string): Promise<void> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can delete membership plans');
        }

        const membershipPlan = await this.findOne(id);
        // Prevent deletion if any subscriptions reference this plan
        const referencingSubscriptions = await this.subscriptionRepository.count({ where: { planId: id } });
        if (referencingSubscriptions > 0) {
            throw new BadRequestException('This membership plan is already in use, you can not delete it.');
        }

        await this.membershipPlanRepository.remove(membershipPlan);
    }

    // User subscription methods
    async subscribe(userId: string, planId: string, billingCycle?: 'monthly' | 'annually'): Promise<{ subscription: SubscriptionEntity; checkoutUrl: string | null }> {
        // Block sub-accounts from subscribing
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        if (user.sub_account) {
            throw new BadRequestException('Sub-accounts cannot purchase membership plans. Only the main account can subscribe.');
        }

        // 1. Prevent duplicate active subscription
        const activeSubscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });

        if (activeSubscription) {
            throw new BadRequestException({
                message: 'You already have an active membership subscription',
                error: 'ACTIVE_SUBSCRIPTION_EXISTS',
                details: { currentPlan: activeSubscription.plan.name }
            });
        }

        // 2. Clean up old incomplete subscriptions for same plan (abandoned checkouts)
        const oldIncompleteSubscriptions = await this.subscriptionRepository.find({
            where: { userId, planId, billingCycle: billingCycle as any, status: 'INCOMPLETE' }
        });

        if (oldIncompleteSubscriptions.length > 0) {
            await this.subscriptionRepository.remove(oldIncompleteSubscriptions);
        }

        const plan = await this.membershipPlanRepository.findOne({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Membership plan not found');

        // FREE plan ($0) — activate immediately, no Stripe needed
        if ((plan.monthlyAmount == null || plan.monthlyAmount == 0) && 
            (plan.yearlyAmount == null || plan.yearlyAmount == 0)) {
            const newSubscription = this.subscriptionRepository.create({
                userId,
                stripeCustomerId: 'free',
                stripeSubscriptionId: null,
                planId,
                billingCycle: 'monthly', // default, irrelevant for free
                status: 'ACTIVE',
                currentPeriodEnd: new Date('2099-12-31')
            });
            const saved = await this.subscriptionRepository.save(newSubscription);
            await this.userProfileRepository.update(
                { user_id: userId },
                { current_subscription_id: saved.id, has_membership: true }
            );
            return { subscription: saved, checkoutUrl: null };
        }

        // Paid plans require billing_cycle
        if (!billingCycle) {
            throw new BadRequestException('billing_cycle is required for paid plans');
        }

        // Validate billing cycle value
        if (!['monthly', 'annually'].includes(billingCycle)) {
            throw new BadRequestException('Invalid billing_cycle. Must be "monthly" or "annually".');
        }

        // 3. Get or create Stripe Customer with US as default country
        // Exclude 'free' placeholder — it's not a real Stripe customer ID
        const lastPaidSub = await this.subscriptionRepository
            .createQueryBuilder('sub')
            .where('sub.userId = :userId', { userId })
            .andWhere('sub.stripeCustomerId IS NOT NULL')
            .andWhere("sub.stripeCustomerId != 'free'")
            .orderBy('sub.createdAt', 'DESC')
            .getOne();

        let stripeCustomerId = lastPaidSub?.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                address: {
                    country: 'US' // Only set country, no other address fields
                },
                metadata: { userId }
            });
            stripeCustomerId = customer.id;
        } else {
            // Update existing customer to have US as default country
            await this.stripe.customers.update(stripeCustomerId, {
                address: {
                    country: 'US' // Only country, no address collection
                }
            });
        }

        let priceId: string;
        if (billingCycle === 'monthly') {
            if (!plan.monthlyPriceId) {
                throw new BadRequestException('Monthly billing is not available for this plan');
            }
            priceId = plan.monthlyPriceId;
        } else if (billingCycle === 'annually') {
            if (!plan.annualyPriceId) {
                throw new BadRequestException('Annual billing is not available for this plan');
            }
            priceId = plan.annualyPriceId;
        } else {
            throw new BadRequestException('Invalid billing cycle');
        }

        // 4. Create Checkout Session directly (NO pre-creating subscription)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendUrl}/subscription/cancel`;

        // 5. Create local record as INCOMPLETE (will be activated in webhook)
        const newSubscription = this.subscriptionRepository.create({
            userId,
            stripeCustomerId,
            // stripeSubscriptionId will be set in webhook
            planId,
            billingCycle: billingCycle as any,
            status: 'INCOMPLETE',
            currentPeriodEnd: new Date(Date.now() + this.getBillingCycleDuration(billingCycle)) // fallback
        });

        const savedSubscription = await this.subscriptionRepository.save(newSubscription);

        // CREATE CHECKOUT SESSION WITH US PRE-SELECTED (NO ADDRESS COLLECTION)
        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: stripeCustomerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,

            // ✅ MOST IMPORTANT FIX
            client_reference_id: savedSubscription.id,

            // ✅ DO NOT COLLECT BILLING ADDRESS - only country will be pre-set from customer
            // billing_address_collection: 'auto', // This will use customer's country but not require full address
            
            // ✅ SET ENGLISH LOCALE
            locale: 'en',

            metadata: {
                subscriptionId: savedSubscription.id,
                userId,
                planId,
                billingCycle
            }
        });

        return {
            subscription: savedSubscription,
            checkoutUrl: session.url!
        };
    }

    async getMySubscription(userId: string): Promise<SubscriptionEntity | null> {
        const user = await this.subscriptionRepository.manager
            .getRepository('users')
            .findOne({ where: { id: userId } }) as any;

        // For sub-accounts, look up the parent's subscription
        const lookupUserId = (user?.sub_account && user?.parent_id) ? user.parent_id : userId;

        return await this.subscriptionRepository.findOne({
            where: { userId: lookupUserId },
            relations: ['plan'],
            order: { createdAt: 'DESC' }
        });
    }

    async cancelSubscription(userId: string): Promise<void> {
        const sub = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' }
        });

        if (!sub) {
            throw new NotFoundException('No active subscription found for this user');
        }

        // Only call Stripe for paid plans that have a Stripe subscription ID
        if (sub.stripeSubscriptionId && sub.stripeCustomerId !== 'free') {
            await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        }

        // Update in database
        sub.status = 'SUSPENDED'; 
        await this.subscriptionRepository.save(sub);
        
        // Update user profile to clear current subscription and revoke membership
        await this.userProfileRepository.update(
            { user_id: userId },
            { 
                current_subscription_id: null,
                has_membership: false,
                is_directory: false
            }
        );

        // Delete contractor directory profile if exists
        await this.contractorDirectoryRepository.delete({ contractorId: userId });
    }

    async updateAutoRenewal(userId: string, autoRenewalEnabled: boolean): Promise<any> {
        // Fetch the user's ACTIVE subscription
        const subscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' }
        });

        if (!subscription) {
            throw new NotFoundException('No active subscription found for this user');
        }

        // Prevent update if subscription is not ACTIVE
        if (subscription.status !== 'ACTIVE') {
            throw new BadRequestException(`Cannot update auto-renewal for subscription with status: ${subscription.status}`);
        }

        // Log the change
        console.log(`🔄 Auto-renewal ${autoRenewalEnabled ? 'ENABLED' : 'DISABLED'} for user ${userId}, subscription ${subscription.id}`);

        // Update the database field
        subscription.autoRenewalEnabled = autoRenewalEnabled;
        await this.subscriptionRepository.save(subscription);

        // Update Stripe subscription
        if (subscription.stripeSubscriptionId) {
            try {
                await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                    cancel_at_period_end: !autoRenewalEnabled
                });
                console.log(`✅ Stripe subscription ${subscription.stripeSubscriptionId} updated: cancel_at_period_end = ${!autoRenewalEnabled}`);
            } catch (stripeError) {
                console.error('❌ Failed to update Stripe subscription:', stripeError);
                // Rollback database change if Stripe update fails
                subscription.autoRenewalEnabled = !autoRenewalEnabled;
                await this.subscriptionRepository.save(subscription);
                throw new BadRequestException('Failed to update auto-renewal setting in payment system');
            }
        } else {
            console.log('⚠️ No Stripe subscription ID found, only updated local database');
        }

        return {
            subscriptionId: subscription.id,
            autoRenewalEnabled: subscription.autoRenewalEnabled
        };
    }

    async changePlan(userId: string, newPlanId: string): Promise<SubscriptionEntity> {
        const currentSub = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' }
        });

        if (!currentSub) {
            throw new NotFoundException('No active subscription found to change');
        }

        if (!currentSub.stripeSubscriptionId) {
            throw new BadRequestException('Subscription has no Stripe subscription ID');
        }

        const newPlan = await this.membershipPlanRepository.findOne({ where: { id: newPlanId } });
        if (!newPlan) {
            throw new NotFoundException('New membership plan not found');
        }

        let newPriceId: string;
        if (currentSub.billingCycle === 'monthly') {
            if (!newPlan.monthlyPriceId) {
                throw new BadRequestException('Monthly billing is not available for the new plan');
            }
            newPriceId = newPlan.monthlyPriceId;
        } else if (currentSub.billingCycle === 'annually') {
            if (!newPlan.annualyPriceId) {
                throw new BadRequestException('Annual billing is not available for the new plan');
            }
            newPriceId = newPlan.annualyPriceId;
        } else {
            throw new BadRequestException('Invalid billing cycle');
        }

        // Update in Stripe
        const stripeSub = await this.stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
        await this.stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
            items: [{
                id: stripeSub.items.data[0].id,
                price: newPriceId,
            }],
            proration_behavior: 'always_invoice',
        });

        // Update locally
        currentSub.planId = newPlanId;
        return await this.subscriptionRepository.save(currentSub);
    }

    async getSubscriptionPaymentStatus(subscriptionId: string, userId: string): Promise<any> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { id: subscriptionId, userId },
            relations: ['plan']
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        // If no Stripe subscription ID, return basic info
        if (!subscription.stripeSubscriptionId) {
            return {
                subscriptionId: subscription.id,
                status: subscription.status,
                stripeStatus: 'incomplete',
                currentPeriodEnd: subscription.currentPeriodEnd,
                plan: subscription.plan,
                paymentStatus: 'pending',
                stripeSubscriptionId: null,
                invoiceStatus: 'pending'
            };
        }

        // Get latest status from Stripe
        const stripeSubscription = await this.stripe.subscriptions.retrieve(
            subscription.stripeSubscriptionId,
            { expand: ['latest_invoice.payment_intent'] }
        );

        const invoice = stripeSubscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

        return {
            subscriptionId: subscription.id,
            status: subscription.status,
            stripeStatus: stripeSubscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            plan: subscription.plan,
            paymentStatus: paymentIntent?.status || 'unknown',
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            invoiceStatus: invoice?.status || 'unknown'
        };
    }

    async syncUserMembershipStatus(userId: string): Promise<any> {
        // Get user's current active subscription
        const activeSubscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });

        if (activeSubscription) {
            // User has active subscription - set has_membership to true
            await this.userProfileRepository.update(
                { user_id: userId },
                { 
                    current_subscription_id: activeSubscription.id,
                    has_membership: true
                }
            );
            return {
                action: 'updated',
                has_membership: true,
                current_subscription_id: activeSubscription.id,
                subscription: activeSubscription
            };
        } else {
            // No active subscription - set has_membership to false
            await this.userProfileRepository.update(
                { user_id: userId },
                { 
                    current_subscription_id: null,
                    has_membership: false
                }
            );
            return {
                action: 'updated',
                has_membership: false,
                current_subscription_id: null
            };
        }
    }

    async createCheckoutSession(subscriptionId: string): Promise<{ id: string; url: string }> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { id: subscriptionId },
            relations: ['plan']
        });

        if (!subscription) {
            throw new NotFoundException('Subscription not found');
        }

        let priceId: string;
        if (subscription.billingCycle === 'monthly') {
            if (!subscription.plan.monthlyPriceId) {
                throw new BadRequestException('Monthly billing is not available for this plan');
            }
            priceId = subscription.plan.monthlyPriceId;
        } else if (subscription.billingCycle === 'annually') {
            if (!subscription.plan.annualyPriceId) {
                throw new BadRequestException('Annual billing is not available for this plan');
            }
            priceId = subscription.plan.annualyPriceId;
        } else {
            throw new BadRequestException('Invalid billing cycle');
        }
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendUrl}/subscription/cancel`;

        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: subscription.stripeCustomerId,
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            
            // ✅ SET US AS DEFAULT COUNTRY (NO ADDRESS COLLECTION)
            locale: 'en',
            
            metadata: {
                subscriptionId: subscription.id,
                userId: subscription.userId
            }
        });

        return {
            id: session.id,
            url: session.url!
        };
    }

    async cleanupAbandonedSubscriptions(userId?: string): Promise<{ cleaned: number }> {
        // Clean up incomplete subscriptions older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const whereCondition: any = {
            status: 'INCOMPLETE',
            createdAt: { $lt: oneHourAgo }
        };
        
        if (userId) {
            whereCondition.userId = userId;
        }
        
        const abandonedSubscriptions = await this.subscriptionRepository.find({
            where: whereCondition
        });
        
        if (abandonedSubscriptions.length > 0) {
            await this.subscriptionRepository.remove(abandonedSubscriptions);
        }
        
        return { cleaned: abandonedSubscriptions.length };
    }

    private getBillingCycleDuration(billingCycle: string): number {
        switch (billingCycle) {
            case 'monthly':
                return 30 * 24 * 60 * 60 * 1000; // 30 days
            case 'annually':
                return 365 * 24 * 60 * 60 * 1000; // 365 days
            default:
                return 30 * 24 * 60 * 60 * 1000; // default to monthly
        }
    }

    async getTotalPurchasedUsers(userId: string): Promise<number> {
        const result = await this.userPurchaseRepository
            .createQueryBuilder('up')
            .select('SUM(up.numberOfUsers)', 'total')
            .where('up.purchasedByUserId = :userId', { userId })
            .andWhere("up.status = 'completed'")
            .getRawOne();
        
        return result?.total ? parseInt(result.total) : 0;
    }

    async purchaseAdditionalUsers(
        userId: string,
        dto: PurchaseAdditionalUsersDto
    ): Promise<{ checkoutUrl: string; purchaseId: string }> {
        // Verify user is CONTRACTOR and not a sub-account
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        if (user.role !== UserRole.CONTRACTOR) {
            throw new BadRequestException('Only contractors can purchase additional users');
        }
        if (user.sub_account) {
            throw new BadRequestException('Sub-accounts cannot purchase additional users. Only the main account can.');
        }

        // Get user's active subscription and membership plan
        const activeSubscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });
        
        if (!activeSubscription) {
            throw new BadRequestException('You must have an active membership subscription to purchase additional users');
        }

        // Validate if they have unused seats
        const maxUsers = activeSubscription.plan.maxUsers || 0;
        const purchasedUsers = await this.getTotalPurchasedUsers(userId);
        const subCount = await this.userRepository.count({ where: { parent_id: userId } });
        const totalAllowedUsers = maxUsers + purchasedUsers;

        if (totalAllowedUsers > 0 && subCount < totalAllowedUsers) {
            const remaining = totalAllowedUsers - subCount;
            throw new BadRequestException(`You still have ${remaining} unused user seat(s) available. Please use your existing seats before purchasing additional ones.`);
        }

        // Get price per user from app-settings based on billing cycle
        const isAnnual = activeSubscription.billingCycle === 'annually';
        const priceKey = isAnnual ? 'add_user_price_annual' : 'add_user_price';
        const defaultPrice = isAnnual ? '300.00' : '25.00';
        const pricePerUserStr = await this.appSettingsService.getValue(priceKey, defaultPrice);
        const pricePerUser = parseFloat(pricePerUserStr);

        // Calculate total amount
        const totalAmount = dto.numberOfUsers * pricePerUser;
        const amountInCents = Math.round(totalAmount * 100);

        // Get or create Stripe customer
        let stripeCustomerId = activeSubscription.stripeCustomerId;
        if (!stripeCustomerId || stripeCustomerId === 'free') {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                address: {
                    country: 'US'
                },
                metadata: { userId }
            });
            stripeCustomerId = customer.id;
        }

        // Create user purchase record
        const userPurchase = this.userPurchaseRepository.create({
            purchasedByUserId: userId,
            numberOfUsers: dto.numberOfUsers,
            pricePerUser,
            totalAmount,
            status: 'pending',
            metadata: {
                subscriptionId: activeSubscription.id,
                planId: activeSubscription.planId
            }
        });
        const savedPurchase = await this.userPurchaseRepository.save(userPurchase);

        // Create Stripe checkout session for one-time payment
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendUrl}/purchase/cancel`;

        const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer: stripeCustomerId,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Additional Staff Members (${dto.numberOfUsers} users @ $${pricePerUser.toFixed(2)} each)`,
                        description: `Purchase ${dto.numberOfUsers} additional staff member seat${dto.numberOfUsers > 1 ? 's' : ''} for your contractor account`
                    },
                    unit_amount: Math.round(pricePerUser * 100)
                },
                quantity: dto.numberOfUsers
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            locale: 'en',
            metadata: {
                userPurchaseId: savedPurchase.id,
                userId,
                numberOfUsers: dto.numberOfUsers,
                type: 'ADDITIONAL_USERS'
            }
        });

        // Update purchase record with checkout session ID
        savedPurchase.stripeCheckoutSessionId = session.id;
        await this.userPurchaseRepository.save(savedPurchase);

        return {
            checkoutUrl: session.url!,
            purchaseId: savedPurchase.id
        };
    }

    async reactivateUsers(
        userId: string,
        dto: ReactivateUsersDto
    ): Promise<{ checkoutUrl: string; purchaseId: string }> {
        // Verify user is CONTRACTOR and not a sub-account
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        if (user.role !== UserRole.CONTRACTOR) {
            throw new BadRequestException('Only contractors can reactivate users');
        }
        if (user.sub_account) {
            throw new BadRequestException('Sub-accounts cannot reactivate users. Only the main account can.');
        }

        // Get user's active subscription and membership plan
        const activeSubscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });
        
        if (!activeSubscription) {
            throw new BadRequestException('You must have an active membership subscription to reactivate users');
        }

        // Verify that all provided userIds are actual disabled sub-accounts of this contractor
        const subUsers = await this.userRepository.find({
            where: { 
                id: In(dto.userIds),
                parent_id: userId,
                sub_account: true
            }
        });

        if (subUsers.length !== dto.userIds.length) {
            throw new BadRequestException('One or more user IDs are invalid or do not belong to you');
        }

        const alreadyActive = subUsers.filter(u => u.is_active);
        if (alreadyActive.length > 0) {
            throw new BadRequestException('One or more selected users are already active');
        }

        const numberOfUsers = subUsers.length;

        // Get price per user from app-settings based on billing cycle
        const isAnnual = activeSubscription.billingCycle === 'annually';
        const priceKey = isAnnual ? 'add_user_price_annual' : 'add_user_price';
        const defaultPrice = isAnnual ? '300.00' : '25.00';
        const pricePerUserStr = await this.appSettingsService.getValue(priceKey, defaultPrice);
        const pricePerUser = parseFloat(pricePerUserStr);

        // Calculate total amount
        const totalAmount = numberOfUsers * pricePerUser;

        // Get or create Stripe customer
        let stripeCustomerId = activeSubscription.stripeCustomerId;
        if (!stripeCustomerId || stripeCustomerId === 'free') {
            const customer = await this.stripe.customers.create({
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
                address: {
                    country: 'US'
                },
                metadata: { userId }
            });
            stripeCustomerId = customer.id;
        }

        // Create user purchase record
        const userPurchase = this.userPurchaseRepository.create({
            purchasedByUserId: userId,
            numberOfUsers,
            pricePerUser,
            totalAmount,
            status: 'pending',
            metadata: {
                subscriptionId: activeSubscription.id,
                planId: activeSubscription.planId,
                reactivateUserIds: dto.userIds.join(',')
            }
        });
        const savedPurchase = await this.userPurchaseRepository.save(userPurchase);

        // Create Stripe checkout session for one-time payment
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const successUrl = `${frontendUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendUrl}/purchase/cancel`;

        const session = await this.stripe.checkout.sessions.create({
            mode: 'payment',
            customer: stripeCustomerId,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Reactivate Staff Members (${numberOfUsers} users @ $${pricePerUser.toFixed(2)} each)`,
                        description: `Reactivate ${numberOfUsers} staff member seat${numberOfUsers > 1 ? 's' : ''} for your contractor account`
                    },
                    unit_amount: Math.round(pricePerUser * 100)
                },
                quantity: numberOfUsers
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            locale: 'en',
            metadata: {
                userPurchaseId: savedPurchase.id,
                userId,
                numberOfUsers,
                type: 'REACTIVATE_USERS',
                reactivateUserIds: dto.userIds.join(',')
            }
        });

        // Update purchase record with checkout session ID
        savedPurchase.stripeCheckoutSessionId = session.id;
        await this.userPurchaseRepository.save(savedPurchase);

        return {
            checkoutUrl: session.url!,
            purchaseId: savedPurchase.id
        };
    }
}