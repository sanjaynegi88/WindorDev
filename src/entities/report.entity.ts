import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Property } from './property.entity';
import { User } from './user.entity';

@Entity('reports')
export class Report {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    property_id: string;

    @ManyToOne(() => Property)
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ type: 'text' }) // Using text to match enum and support 'ROOFING' change
    report_type: string;

    @Column({ default: false })
    verified_by_city: boolean;

    @Column({ nullable: true })
    verified_by_city_user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'verified_by_city_user_id' })
    verifier: User;

    @Column({ default: false })
    immutable: boolean;

    @Column({ nullable: true })
    created_by: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
