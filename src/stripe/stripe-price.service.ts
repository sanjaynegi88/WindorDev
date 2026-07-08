import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeConfigService } from './stripe-config.service';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { CreatePlanPricesDto } from './dto/create-plan-prices.dto';
import Stripe from 'stripe';

export interface StripePriceResponse {
    productId: string;
    monthlyPriceId: string | null;
    annualyPriceId: string | null;
    membershipPlan: MembershipPlan;
}

@Injectable()
export class StripePriceService {
    private stripe: Stripe;

    constructor(
        private stripeConfig: StripeConfigService,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
    ) {
        this.stripe = this.stripeConfig.getStripe();
    }

    async createStripeProductAndPrices(request: CreatePlanPricesDto): Promise<{productId: string, monthlyPriceId: string | null, annualyPriceId: string | null}> {
        try {
            // 1. Create Product in Stripe
            const product = await this.stripe.products.create({
                name: request.name,
                description: request.description || undefined,
                metadata: {
                    features: JSON.stringify(request.features),
                    type: 'membership_plan'
                }
            });

            let monthlyPriceId: string | null = null;
            let annualyPriceId: string | null = null;

            // 2. Create Monthly Price only if monthlyAmount > 0
            if (request.monthlyAmount && request.monthlyAmount > 0) {
                const monthlyPrice = await this.stripe.prices.create({
                    product: product.id,
                    unit_amount: request.monthlyAmount,
                    currency: 'usd',
                    recurring: {
                        interval: 'month',
                        interval_count: 1
                    },
                    metadata: {
                        billing_cycle: 'monthly',
                        plan_name: request.name
                    }
                });
                monthlyPriceId = monthlyPrice.id;
            }

            // 3. Create Annual Price only if yearlyAmount > 0
            if (request.yearlyAmount && request.yearlyAmount > 0) {
                const annualPrice = await this.stripe.prices.create({
                    product: product.id,
                    unit_amount: request.yearlyAmount,
                    currency: 'usd',
                    recurring: {
                        interval: 'year',
                        interval_count: 1
                    },
                    metadata: {
                        billing_cycle: 'annually',
                        plan_name: request.name
                    }
                });
                annualyPriceId = annualPrice.id;
            }

            return {
                productId: product.id,
                monthlyPriceId,
                annualyPriceId
            };

        } catch (error) {
            console.error('Failed to create Stripe product/prices:', error);
            throw new Error(`Stripe setup failed: ${error.message}`);
        }
    }
    async createProductWithPrices(request: CreatePlanPricesDto): Promise<StripePriceResponse> {
        const stripeResult = await this.createStripeProductAndPrices(request);
        
        // Create Database Record
        const membershipPlan = this.membershipPlanRepository.create({
            name: request.name,
            description: request.description,
            monthlyPriceId: stripeResult.monthlyPriceId,
            annualyPriceId: stripeResult.annualyPriceId,
            monthlyAmount: request.monthlyAmount / 100, // Convert cents to dollars
            yearlyAmount: request.yearlyAmount / 100,   // Convert cents to dollars
            features: request.features,
            isActive: request.isActive
        });

        const savedPlan = await this.membershipPlanRepository.save(membershipPlan);

        return {
            productId: stripeResult.productId,
            monthlyPriceId: stripeResult.monthlyPriceId,
            annualyPriceId: stripeResult.annualyPriceId,
            membershipPlan: savedPlan
        };
    }

    async listAllPrices(): Promise<Stripe.Price[]> {
        const prices = await this.stripe.prices.list({
            limit: 100,
            active: true
        });
        return prices.data;
    }

    async getPriceDetails(priceId: string): Promise<Stripe.Price> {
        return await this.stripe.prices.retrieve(priceId);
    }

    async deactivatePrice(priceId: string): Promise<void> {
        await this.stripe.prices.update(priceId, {
            active: false
        });
    }
}