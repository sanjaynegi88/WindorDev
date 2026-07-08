import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { MembershipPlan } from './membership-plan.entity';

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'varchar' })
    stripeCustomerId: string;

    @Column({ type: 'varchar', nullable: true })
    stripeSubscriptionId: string | null;

    @Column({ type: 'uuid' })
    planId: string;

    @Column({ type: 'varchar', length: 20 })
    billingCycle: 'monthly' | 'annually';

    @Column({ type: 'varchar', length: 20 })
    status: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'INCOMPLETE';

    @Column({ type: 'timestamp' })
    currentPeriodEnd: Date;

    @Column({ type: 'timestamp', nullable: true })
    gracePeriodEndsAt: Date | null;

    @Column({ type: 'boolean', default: true, name: 'auto_renewal_enabled' })
    autoRenewalEnabled: boolean;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => MembershipPlan)
    @JoinColumn({ name: 'planId' })
    plan: MembershipPlan;
}