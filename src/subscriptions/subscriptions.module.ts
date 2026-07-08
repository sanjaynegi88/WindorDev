import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { MembershipPlansModule } from '../membership-plans/membership-plans.module';

@Module({
    imports: [MembershipPlansModule],
    controllers: [SubscriptionsController],
})
export class SubscriptionsModule {}