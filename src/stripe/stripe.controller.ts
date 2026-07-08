import { Controller, Post, RawBody, Headers, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StripeService } from './stripe.service';

@Controller('api/stripe')
export class StripeController {
    constructor(private readonly stripeService: StripeService) {}

    @Post('webhook')
    async handleWebhook(
        @RawBody() body: Buffer,
        @Headers('stripe-signature') signature: string
    ) {
        console.log('🚨 [WEBHOOK ENTRY] Webhook endpoint hit!', {
            hasBody: !!body,
            bodyLength: body?.length,
            hasSignature: !!signature,
            timestamp: new Date().toISOString()
        });
        
        try {
            await this.stripeService.handleWebhook(body, signature);
            console.log('✅ [STRIPE CONTROLLER] Webhook processed successfully');
            return { received: true };
        } catch (error) {
            console.error('❌ [WEBHOOK ERROR] Webhook processing failed:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    @Post('confirm-payment')
    @UseGuards(AuthGuard('firebase-jwt'))
    async confirmPayment(
        @Body() body: { sessionId?: string; session_id?: string }
    ) {
        // Accept both sessionId and session_id for flexibility
        const sessionId = body?.sessionId || body?.session_id;
        
        if (!sessionId) {
            throw new BadRequestException('sessionId or session_id is required in request body');
        }
        
        // Validate session ID format (Stripe session IDs start with cs_)
        if (!sessionId.startsWith('cs_')) {
            throw new BadRequestException('Invalid session ID format. Must start with "cs_"');
        }
        
        return await this.stripeService.confirmPayment(sessionId);
    }
}