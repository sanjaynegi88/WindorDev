import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeConfigService {
    private stripe: Stripe;

    constructor(private configService: ConfigService) {
        const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
        
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2026-02-25.clover', // Latest supported API version
        });
    }

    getStripe(): Stripe {
        return this.stripe;
    }

    getPublishableKey(): string {
        return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY') || '';
    }

    getWebhookSecret(): string {
        return this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    }
}