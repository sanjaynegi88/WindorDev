import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { Report } from '../entities/report.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { ReportAccessService } from './report-access.service';
import { ReportAccessController } from './report-access.controller';
import { StripeModule } from '../stripe/stripe.module';
import { PropertiesModule } from '../properties/properties.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Property, Report, Subscription, MembershipPlan, UserReportUsage, ReportPurchase]),
        StripeModule,
        forwardRef(() => PropertiesModule),
        NotificationsModule,
        AppSettingsModule,
    ],
    providers: [ReportAccessService],
    controllers: [ReportAccessController],
    exports: [ReportAccessService]
})
export class ReportAccessModule {}
