import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { ContractorDirectoryProfile } from '../entities/contractor-directory-profile.entity';
import { UserPurchase } from '../entities/user-purchase.entity';
import { MembershipPlansService } from './membership-plans.service';
import { MembershipPlansController } from './membership-plans.controller';
import { StripeModule } from '../stripe/stripe.module';
import { AuditModule } from '../audit/audit.module';
import { AppSettingsModule } from '../app-settings/app-settings.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([MembershipPlan, Subscription, User, UserProfile, ContractorDirectoryProfile, UserPurchase]),
        StripeModule,
        AuditModule,
        AppSettingsModule
    ],
    providers: [MembershipPlansService],
    controllers: [MembershipPlansController],
    exports: [MembershipPlansService],
})
export class MembershipPlansModule {}