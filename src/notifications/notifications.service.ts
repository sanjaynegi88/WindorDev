import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(Notification)
        private notificationRepository: Repository<Notification>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async create(data: {
        recipientUserId: string;
        type: NotificationType;
        title: string;
        message?: string;
        metadata?: Record<string, any>;
    }): Promise<Notification> {
        const notification = this.notificationRepository.create(data);
        return await this.notificationRepository.save(notification);
    }

    async findMyNotifications(userId: string): Promise<Notification[]> {
        return await this.notificationRepository.find({
            where: { 
                recipientUserId: userId,
                isDeleted: false 
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findOne(id: string, userId: string): Promise<Notification> {
        const notification = await this.notificationRepository.findOne({
            where: { 
                id, 
                recipientUserId: userId,
                isDeleted: false 
            }
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        return notification;
    }

    async markAsRead(id: string, userId: string): Promise<Notification> {
        const notification = await this.findOne(id, userId);
        notification.isRead = true;
        return await this.notificationRepository.save(notification);
    }

    async delete(id: string, userId: string): Promise<void> {
        const notification = await this.findOne(id, userId);
        notification.isDeleted = true;
        await this.notificationRepository.save(notification);
    }

    async bulkDelete(ids: string[], userId: string): Promise<{ deletedCount: number; notFoundIds: string[] }> {
        // First, find which notifications actually exist and belong to the user
        const existingNotifications = await this.notificationRepository.find({
            where: {
                id: In(ids),
                recipientUserId: userId,
                isDeleted: false
            },
            select: ['id']
        });

        const existingIds = existingNotifications.map(n => n.id);
        const notFoundIds = ids.filter(id => !existingIds.includes(id));

        // Only update existing notifications
        if (existingIds.length > 0) {
            await this.notificationRepository.update(
                { 
                    id: In(existingIds),
                    recipientUserId: userId 
                },
                { isDeleted: true }
            );
        }

        return {
            deletedCount: existingIds.length,
            notFoundIds
        };
    }

    async getUnreadCount(userId: string): Promise<number> {
        return await this.notificationRepository.count({
            where: { 
                recipientUserId: userId,
                isRead: false,
                isDeleted: false 
            }
        });
    }

    // Helper methods for creating specific notification types
    async notifySubscriptionActivated(userId: string, planName: string): Promise<void> {
        await this.create({
            recipientUserId: userId,
            type: NotificationType.SUBSCRIPTION_ACTIVATED,
            title: 'Subscription Activated',
            message: `Your ${planName} subscription has been activated successfully.`,
            metadata: { planName }
        });
    }

    async notifyReportGenerated(userId: string, propertyAddress: string): Promise<void> {
        await this.create({
            recipientUserId: userId,
            type: NotificationType.REPORT_GENERATED,
            title: 'Report Generated',
            message: `Your property report for ${propertyAddress} has been generated and is ready for download.`,
            metadata: { propertyAddress }
        });
    }

    async notifyReportPurchased(userId: string, propertyAddress: string, amount: number): Promise<void> {
        await this.create({
            recipientUserId: userId,
            type: NotificationType.REPORT_PURCHASED,
            title: 'Report Purchased',
            message: `You have successfully purchased a report for ${propertyAddress} for $${amount}.`,
            metadata: { propertyAddress, amount }
        });
    }

    // New method for membership purchase notifications
    async notifyMembershipPurchased(userId: string, planName: string, userRole: string, userEmail: string): Promise<void> {
        // Get user details for better notification context
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'first_name', 'last_name', 'email', 'role']
        });

        const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : userEmail;

        // Notify the user who purchased the membership
        await this.create({
            recipientUserId: userId,
            type: NotificationType.MEMBERSHIP_PURCHASED,
            title: 'Membership Activated',
            message: `Congratulations! Your ${planName} membership has been successfully activated. You now have access to all premium features.`,
            metadata: { 
                planName, 
                userRole,
                purchaseType: 'self'
            }
        });

        // Notify all admin users about the membership purchase
        const adminUsers = await this.userRepository.find({
            where: { role: UserRole.ADMIN },
            select: ['id']
        });

        // Create notifications for all admin users
        const adminNotifications = adminUsers.map(admin => ({
            recipientUserId: admin.id,
            type: NotificationType.MEMBERSHIP_PURCHASED,
            title: 'New Membership Purchase',
            message: `${userName} (${userRole}) has purchased a ${planName} membership.`,
            metadata: {
                planName,
                purchaserUserId: userId,
                purchaserEmail: userEmail,
                purchaserRole: userRole,
                purchaserName: userName,
                purchaseType: 'admin_notification'
            }
        }));

        // Bulk create admin notifications
        if (adminNotifications.length > 0) {
            await this.notificationRepository.save(adminNotifications);
        }
    }

    // Property-related notifications
    async notifyPropertyCreated(propertyId: string, propertyAddress: string, propertyOwnerId: string, contractorId: string, cityId: string): Promise<void> {
        // Get property details
        const contractor = await this.userRepository.findOne({
            where: { id: contractorId },
            select: ['first_name', 'last_name', 'email']
        });
        
        const contractorName = contractor ? `${contractor.first_name || ''} ${contractor.last_name || ''}`.trim() || contractor.email : 'Unknown Contractor';

        // Notify property owner
        await this.create({
            recipientUserId: propertyOwnerId,
            type: NotificationType.PROPERTY_CREATED,
            title: 'Property Added',
            message: `A new property has been added to your account at ${propertyAddress} by ${contractorName}.`,
            metadata: { propertyId, propertyAddress, contractorId, contractorName }
        });

        // Notify contractor
        await this.create({
            recipientUserId: contractorId,
            type: NotificationType.PROPERTY_CREATED,
            title: 'Property Created',
            message: `You have successfully created a property at ${propertyAddress}.`,
            metadata: { propertyId, propertyAddress, propertyOwnerId }
        });

        // Notify city inspector for the city
        const cityInspectors = await this.userRepository.find({
            where: { role: UserRole.CITY_INSPECTOR, city_id: cityId },
            select: ['id']
        });

        const inspectorNotifications = cityInspectors.map(inspector => ({
            recipientUserId: inspector.id,
            type: NotificationType.PROPERTY_CREATED,
            title: 'New Property in Your City',
            message: `A new property has been added at ${propertyAddress} in your city by ${contractorName}.`,
            metadata: { propertyId, propertyAddress, contractorId, contractorName }
        }));

        if (inspectorNotifications.length > 0) {
            await this.notificationRepository.save(inspectorNotifications);
        }
    }

    async notifyReportGeneratedForProperty(propertyId: string, propertyAddress: string, propertyOwnerId: string, contractorId: string, cityId: string): Promise<void> {
        // Get contractor details
        const contractor = await this.userRepository.findOne({
            where: { id: contractorId },
            select: ['first_name', 'last_name', 'email']
        });
        
        const contractorName = contractor ? `${contractor.first_name || ''} ${contractor.last_name || ''}`.trim() || contractor.email : 'Unknown Contractor';

        // Notify property owner
        await this.create({
            recipientUserId: propertyOwnerId,
            type: NotificationType.REPORT_GENERATED,
            title: 'Property Report Generated',
            message: `Your property report for ${propertyAddress} has been generated and is ready for download.`,
            metadata: { propertyId, propertyAddress, contractorId, contractorName }
        });

        // Notify contractor
        await this.create({
            recipientUserId: contractorId,
            type: NotificationType.REPORT_GENERATED,
            title: 'Report Generated',
            message: `Report has been successfully generated for property at ${propertyAddress}.`,
            metadata: { propertyId, propertyAddress, propertyOwnerId }
        });

        // Notify city inspector for the city
        const cityInspectors = await this.userRepository.find({
            where: { role: UserRole.CITY_INSPECTOR, city_id: cityId },
            select: ['id']
        });

        const inspectorNotifications = cityInspectors.map(inspector => ({
            recipientUserId: inspector.id,
            type: NotificationType.REPORT_GENERATED,
            title: 'Property Report Generated in Your City',
            message: `A property report has been generated for ${propertyAddress} in your city by ${contractorName}.`,
            metadata: { propertyId, propertyAddress, contractorId, contractorName }
        }));

        if (inspectorNotifications.length > 0) {
            await this.notificationRepository.save(inspectorNotifications);
        }
    }

    async notifyContractorReportDownloaded(contractorId: string, propertyAddress: string, propertyId: string, downloadedByUserId: string): Promise<void> {
        const downloader = await this.userRepository.findOne({
            where: { id: downloadedByUserId },
            select: ['id', 'first_name', 'last_name', 'email']
        });
        const downloaderName = downloader
            ? `${downloader.first_name || ''} ${downloader.last_name || ''}`.trim() || downloader.email
            : 'Someone';

        await this.create({
            recipientUserId: contractorId,
            type: NotificationType.REPORT_PURCHASED,
            title: 'Your Property Report Was Downloaded',
            message: `${downloaderName} has downloaded a report for your property at ${propertyAddress}.`,
            metadata: { propertyId, propertyAddress, downloadedByUserId, downloaderName }
        });
    }

    async notifyPropertyVerificationStatusChanged(propertyId: string, propertyAddress: string, propertyOwnerId: string, isVerified: boolean, inspectorId: string): Promise<void> {
        // Get inspector details
        const inspector = await this.userRepository.findOne({
            where: { id: inspectorId },
            select: ['first_name', 'last_name', 'email', 'role']
        });
        
        const inspectorName = inspector ? `${inspector.first_name || ''} ${inspector.last_name || ''}`.trim() || inspector.email : 'Inspector';
        const inspectorRole = inspector?.role === UserRole.ADMIN ? 'Administrator' : 'City Inspector';

        const status = isVerified ? 'verified' : 'unverified';
        const action = isVerified ? 'approved' : 'revoked';

        // Notify property owner
        await this.create({
            recipientUserId: propertyOwnerId,
            type: NotificationType.PROPERTY_VERIFIED,
            title: `Property ${isVerified ? 'Verified' : 'Verification Revoked'}`,
            message: `Your property at ${propertyAddress} has been ${action} by ${inspectorName} (${inspectorRole}).`,
            metadata: { 
                propertyId, 
                propertyAddress, 
                isVerified, 
                inspectorId, 
                inspectorName, 
                inspectorRole 
            }
        });
    }

    // Membership reminder and grace period notifications
    async notifyMembershipRenewalReminder(userId: string, userEmail: string, planName: string, expiryDate: Date, billingCycle: string): Promise<void> {
        const timeLeft = this.getTimeLeftMessage(expiryDate, billingCycle);
        
        await this.create({
            recipientUserId: userId,
            type: NotificationType.MEMBERSHIP_EXPIRING,
            title: 'Membership Renewal Reminder',
            message: `Your ${planName} membership will expire ${timeLeft}. Please ensure your payment method is up to date for automatic renewal.`,
            metadata: { 
                planName, 
                expiryDate: expiryDate.toISOString(), 
                billingCycle,
                userEmail
            }
        });
    }

    async notifyMembershipSuspended(userId: string, userEmail: string): Promise<void> {
        await this.create({
            recipientUserId: userId,
            type: NotificationType.MEMBERSHIP_SUSPENDED,
            title: 'Membership Suspended',
            message: 'Your membership has been suspended due to payment failure. Please update your payment method and contact support to reactivate your account.',
            metadata: { 
                userEmail,
                suspendedAt: new Date().toISOString()
            }
        });
    }

    private getTimeLeftMessage(expiryDate: Date, billingCycle: string): string {
        const now = new Date();
        const timeDiff = expiryDate.getTime() - now.getTime();
        
        if (billingCycle === 'monthly') {
            const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            return `in ${daysLeft} days`;
        } else if (billingCycle === 'annually') {
            const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            return `in ${daysLeft} days`;
        }
        
        return 'soon';
    }
}