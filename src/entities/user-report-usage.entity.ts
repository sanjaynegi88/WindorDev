import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Subscription } from './subscription.entity';

@Entity('user_report_usage')
@Unique(['userId', 'reportId', 'billingPeriodStart'])
export class UserReportUsage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'user_id' })
    userId: string;

    @Column({ type: 'uuid', nullable: true, name: 'subscription_id' })
    subscriptionId: string | null;

    @Column({ type: 'uuid', name: 'report_id' })
    reportId: string;

    @Column({ type: 'date', name: 'billing_period_start' })
    billingPeriodStart: Date;

    @Column({ type: 'date', name: 'billing_period_end' })
    billingPeriodEnd: Date;

    @Column({ type: 'boolean', default: false, name: 'is_free' })
    isFree: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'price_charged' })
    priceCharged: number;

    @Column({ type: 'varchar', nullable: true, name: 'payment_intent_id' })
    paymentIntentId: string | null;

    @CreateDateColumn({ name: 'used_at' })
    usedAt: Date;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Subscription)
    @JoinColumn({ name: 'subscription_id' })
    subscription: Subscription;
}