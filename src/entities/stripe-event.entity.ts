import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('stripe_events')
export class StripeEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true })
    stripe_event_id: string;

    @Column({ type: 'varchar', length: 100 })
    event_type: string;

    @Column({ type: 'jsonb' })
    payload: any;

    @CreateDateColumn()
    created_at: Date;
}