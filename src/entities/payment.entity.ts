import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { User } from './user.entity';
import { Subscription } from './subscription.entity';

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    subscriptionId: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'varchar', length: 10, default: 'usd' })
    currency: string;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: 'success' | 'failed' | 'pending';

    @Column({ type: 'varchar', length: 255, nullable: true })
    stripe_payment_intent_id: string;

    @CreateDateColumn()
    created_at: Date;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Subscription)
    @JoinColumn({ name: 'subscriptionId' })
    subscription: Subscription;
}
