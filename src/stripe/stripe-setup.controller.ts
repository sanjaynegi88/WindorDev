import { Controller, Post, Get, Body, UseGuards, Req, Param, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { StripePriceService } from './stripe-price.service';
import { CreatePlanPricesDto } from './dto/create-plan-prices.dto';

@Controller('api/stripe-setup')
@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class StripeSetupController {
    constructor(private stripePriceService: StripePriceService) {}

    @Post('create-plan-prices')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async createPlanPrices(@Body() request: CreatePlanPricesDto, @Req() req: any) {
        const result = await this.stripePriceService.createProductWithPrices(request);
        
        return {
            message: 'Membership plan created successfully in Stripe and Database',
            data: {
                stripe: {
                    productId: result.productId,
                    monthlyPriceId: result.monthlyPriceId,
                    annualyPriceId: result.annualyPriceId
                },
                membershipPlan: result.membershipPlan
            },
            createdBy: req.user.id,
            createdAt: new Date().toISOString()
        };
    }
}