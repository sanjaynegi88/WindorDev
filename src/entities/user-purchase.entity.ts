import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_purchases')
export class UserPurchase {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'purchased_by_user_id' })
    purchasedByUserId: string;

    @Column({ type: 'integer', name: 'number_of_users' })
    numberOfUsers: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'price_per_user' })
    pricePerUser: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_amount' })
    totalAmount: number;

    @Column({ type: 'varchar', nullable: true, name: 'payment_intent_id' })
    paymentIntentId: string | null;

    @Column({ type: 'varchar', length: 50, default: 'pending' })
    status: string; // pending, completed, failed

    @Column({ type: 'varchar', nullable: true, name: 'stripe_checkout_session_id' })
    stripeCheckoutSessionId: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
    completedAt: Date | null;

    @Column({ type: 'jsonb', default: '{}' })
    metadata: Record<string, any>;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'purchased_by_user_id' })
    purchasedByUser: User;
}
