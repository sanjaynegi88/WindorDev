import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    UseGuards, 
    Req 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MembershipPlansService } from '../membership-plans/membership-plans.service';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/subscriptions')
@UseGuards(AuthGuard('firebase-jwt'))
export class SubscriptionsController {
    constructor(private readonly membershipPlansService: MembershipPlansService) {}

    @Get('my')
    async getMySubscription(@Req() req: any) {
        const subscription = await this.membershipPlansService.getMySubscription(req.user.id);
        return {
            data: subscription,
            message: 'Subscription retrieved successfully'
        };
    }

    @Post('cancel')
    async cancelSubscription(@Req() req: any) {
        await this.membershipPlansService.cancelSubscription(req.user.id);
        return {
            message: 'Subscription cancelled successfully'
        };
    }

    @Post('change-plan')
    async changePlan(@Body() body: { new_plan_id: string }, @Req() req: any) {
        validateUUID(body.new_plan_id, 'new plan id');
        
        const subscription = await this.membershipPlansService.changePlan(req.user.id, body.new_plan_id);
        return {
            data: subscription,
            message: 'Plan changed successfully'
        };
    }
}