import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { MembershipPlan } from '../../entities/membership-plan.entity';
import { User } from '../../entities/user.entity';
import { UserProfile } from '../../entities/user-profile.entity';
import { NotificationType } from '../../entities/notification.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MembershipSchedulerService {
    constructor(
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserProfile)
        private userProfileRepository: Repository<UserProfile>,
        private notificationsService: NotificationsService,
    ) {}

    // Run every hour to check for reminders and grace periods
    @Cron('0 0 * * * *') // Every hour at minute 0
    async checkMembershipReminders(): Promise<void> {
        console.log('🔔 Checking membership reminders...');
        
        const now = new Date();
        
        // Get all active subscriptions
        const activeSubscriptions = await this.subscriptionRepository.find({
            where: { status: 'ACTIVE' },
            relations: ['plan', 'user']
        });

        for (const subscription of activeSubscriptions) {
            const plan = subscription.plan;
            const user = subscription.user;
            
            if (!plan || !user) continue;

            // Calculate reminder time based on billing cycle
            const reminderTime = this.calculateReminderTime(subscription.currentPeriodEnd, subscription.billingCycle);
            
            // Check if it's time to send reminder (within 1 hour window)
            const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
            
            if (now >= reminderTime && reminderTime < oneHourFromNow && now < subscription.currentPeriodEnd) {
                // Check if reminder already sent recently (to avoid spam)
                const alreadySentRecently = await this.wasReminderSentRecently(subscription.userId, subscription.id, subscription.billingCycle);
                
                if (!alreadySentRecently) {
                    await this.sendRenewalReminder(subscription, user, plan);
                }
            }
        }
    }

    // Run every hour to check grace periods
    @Cron('0 0 * * * *') // Every hour at minute 0
    async checkGracePeriods(): Promise<void> {
        console.log('⏰ Checking grace periods...');
        
        const now = new Date();
        
        // First, check for expired ACTIVE subscriptions and move them to GRACE_PERIOD
        await this.checkExpiredSubscriptions();
        
        // Then, find subscriptions in grace period that have expired
        const expiredGracePeriods = await this.subscriptionRepository.find({
            where: {
                status: 'GRACE_PERIOD',
                gracePeriodEndsAt: LessThan(now)
            },
            relations: ['user']
        });

        for (const subscription of expiredGracePeriods) {
            console.log(`🚫 Grace period expired for subscription ${subscription.id}`);
            
            // Suspend subscription
            subscription.status = 'SUSPENDED';
            await this.subscriptionRepository.save(subscription);

            // Revoke membership access
            await this.userProfileRepository.update(
                { user_id: subscription.userId },
                { 
                    current_subscription_id: null,
                    has_membership: false
                }
            );

            // Send suspension notification
            if (subscription.user) {
                await this.notificationsService.notifyMembershipSuspended(
                    subscription.userId,
                    subscription.user.email
                );
            }
        }
    }

    // Check for expired ACTIVE subscriptions and move them to GRACE_PERIOD
    private async checkExpiredSubscriptions(): Promise<void> {
        const now = new Date();
        
        // Find ACTIVE subscriptions that have expired
        const expiredSubscriptions = await this.subscriptionRepository.find({
            where: {
                status: 'ACTIVE',
                currentPeriodEnd: LessThan(now)
            },
            relations: ['plan']
        });

        for (const subscription of expiredSubscriptions) {
            console.log(`⏰ Subscription ${subscription.id} expired, moving to grace period`);
            
            // Calculate grace period end time
            const gracePeriodDuration = this.calculateGracePeriodDuration(subscription.billingCycle);
            const gracePeriodEndsAt = new Date(subscription.currentPeriodEnd.getTime() + gracePeriodDuration);
            
            // Update subscription to GRACE_PERIOD
            subscription.status = 'GRACE_PERIOD';
            subscription.gracePeriodEndsAt = gracePeriodEndsAt;
            
            await this.subscriptionRepository.save(subscription);
            
            console.log(`📅 Grace period set until ${gracePeriodEndsAt.toLocaleString()}`);
        }
    }

    private calculateGracePeriodDuration(billingCycle: string): number {
        switch (billingCycle) {
            case 'monthly':
            case 'annually':
            default:
                // 2 days grace period for regular plans
                return 2 * 24 * 60 * 60 * 1000;
        }
    }

    private calculateReminderTime(currentPeriodEnd: Date, billingCycle: string): Date {
        const endTime = new Date(currentPeriodEnd);
        
        switch (billingCycle) {
            case 'annually':
                // 30 days before expiry
                return new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000));
            case 'monthly':
            default:
                // 10 days before expiry
                return new Date(endTime.getTime() - (10 * 24 * 60 * 60 * 1000));
        }
    }

    private async wasReminderSentRecently(userId: string, subscriptionId: string, billingCycle: string): Promise<boolean> {
        // Check if a reminder notification was sent recently based on billing cycle
        const now = new Date();
        let timeWindow: Date;
        
        // Check today for all cycles
        timeWindow = new Date(now);
        timeWindow.setHours(0, 0, 0, 0);

        const recentReminder = await this.notificationsService['notificationRepository'].findOne({
            where: {
                recipientUserId: userId,
                type: NotificationType.MEMBERSHIP_EXPIRING,
                createdAt: LessThan(now)
            },
            order: { createdAt: 'DESC' }
        });

        return !!recentReminder && recentReminder.createdAt >= timeWindow;
    }

    private async sendRenewalReminder(subscription: Subscription, user: User, plan: MembershipPlan): Promise<void> {
        try {
            console.log(`📧 Sending renewal reminder to ${user.email} for plan ${plan.name}`);
            
            await this.notificationsService.notifyMembershipRenewalReminder(
                subscription.userId,
                user.email,
                plan.name,
                subscription.currentPeriodEnd,
                subscription.billingCycle
            );
        } catch (error) {
            console.error('Failed to send renewal reminder:', error);
        }
    }

    // Manual method to trigger checks (for testing)
    async manualCheckReminders(): Promise<{ reminders: number; gracePeriods: number }> {
        console.log('🔧 Manual check triggered...');
        
        const remindersBefore = await this.countPendingReminders();
        const gracePeriodseBefore = await this.countExpiredGracePeriods();
        
        await this.checkMembershipReminders();
        await this.checkGracePeriods();
        
        const remindersAfter = await this.countPendingReminders();
        const gracePeriodsAfter = await this.countExpiredGracePeriods();
        
        return {
            reminders: remindersBefore - remindersAfter,
            gracePeriods: gracePeriodseBefore - gracePeriodsAfter
        };
    }

    private async countPendingReminders(): Promise<number> {
        const now = new Date();
        const activeSubscriptions = await this.subscriptionRepository.find({
            where: { status: 'ACTIVE' }
        });

        let count = 0;
        for (const subscription of activeSubscriptions) {
            const reminderTime = this.calculateReminderTime(subscription.currentPeriodEnd, subscription.billingCycle);
            if (now >= reminderTime && now < subscription.currentPeriodEnd) {
                count++;
            }
        }
        return count;
    }

    private async countExpiredGracePeriods(): Promise<number> {
        const now = new Date();
        return await this.subscriptionRepository.count({
            where: {
                status: 'GRACE_PERIOD',
                gracePeriodEndsAt: LessThan(now)
            }
        });
    }
}