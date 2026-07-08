import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
    SUBSCRIPTION_ACTIVATED = 'SUBSCRIPTION_ACTIVATED',
    SUBSCRIPTION_CANCELLED = 'SUBSCRIPTION_CANCELLED',
    MEMBERSHIP_PURCHASED = 'MEMBERSHIP_PURCHASED',
    MEMBERSHIP_EXPIRING = 'MEMBERSHIP_EXPIRING',
    MEMBERSHIP_SUSPENDED = 'MEMBERSHIP_SUSPENDED',
    REPORT_GENERATED = 'REPORT_GENERATED',
    REPORT_PURCHASED = 'REPORT_PURCHASED',
    PROPERTY_CREATED = 'PROPERTY_CREATED',
    PROPERTY_VERIFIED = 'PROPERTY_VERIFIED',
    SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
    ADDITIONAL_USERS_PURCHASED = 'ADDITIONAL_USERS_PURCHASED'
}

@Entity('notifications')
export class Notification {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'recipient_user_id' })
    recipientUserId: string;

    @Column({ type: 'varchar', length: 50 })
    type: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'text', nullable: true })
    message: string;

    @Column({ type: 'jsonb', default: '{}' })
    metadata: Record<string, any>;

    @Column({ type: 'boolean', default: false, name: 'is_read' })
    isRead: boolean;

    @Column({ type: 'boolean', default: false, name: 'is_deleted' })
    isDeleted: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'recipient_user_id' })
    recipient: User;
}