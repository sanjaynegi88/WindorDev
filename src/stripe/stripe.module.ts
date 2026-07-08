import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeConfigService } from './stripe-config.service';
import { StripePriceService } from './stripe-price.service';
import { StripeSetupController } from './stripe-setup.controller';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { UserPurchase } from '../entities/user-purchase.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MembershipPlan,
            Subscription,
            User,
            UserProfile,
            UserReportUsage,
            ReportPurchase,
            UserPurchase,
        ]),
        NotificationsModule,
        AppSettingsModule,
    ],
    controllers: [StripeSetupController, StripeController],
    providers: [StripeConfigService, StripePriceService, StripeService],
    exports: [StripeConfigService, StripePriceService, StripeService],
})
export class StripeModule {}