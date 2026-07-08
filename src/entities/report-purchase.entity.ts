import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('report_purchases')
export class ReportPurchase {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', nullable: true, name: 'property_id' })
    propertyId: string | null;

    @Column({ type: 'uuid', name: 'purchased_by_user_id' })
    purchasedByUserId: string;

    @Column({ type: 'varchar', nullable: true, name: 'payment_intent_id' })
    paymentIntentId: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount_paid' })
    amountPaid: number;

    @CreateDateColumn({ name: 'purchase_date' })
    purchaseDate: Date;

    @Column({ type: 'jsonb', default: '{}' })
    metadata: Record<string, any>;

    @Column({ type: 'varchar', length: 20, default: 'one_time', name: 'purchase_type' })
    purchaseType: string;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'purchased_by_user_id' })
    purchasedByUser: User;
}