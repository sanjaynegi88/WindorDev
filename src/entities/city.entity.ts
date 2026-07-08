import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { State } from './state.entity';

@Entity('cities')
export class City {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'uuid', nullable: true })
    state_id: string;

    @ManyToOne(() => State, state => state.cities)
    @JoinColumn({ name: 'state_id' })
    state_entity: State;

    @Column({ type: 'jsonb', default: [] })
    zip_codes: string[];

    @Column('decimal', { precision: 10, scale: 7, nullable: true })
    latitude: number | null;

    @Column('decimal', { precision: 10, scale: 7, nullable: true })
    longitude: number | null;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}