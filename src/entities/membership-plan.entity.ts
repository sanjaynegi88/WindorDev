import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user.entity';

export enum Level {
    FREE = 'FREE',
    STANDARD = 'STANDARD',
    SILVER = 'SILVER',
    GOLD = 'GOLD'
}

@Entity('membership_plans')
export class MembershipPlan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    monthlyPriceId: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    annualyPriceId: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    monthlyAmount: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    yearlyAmount: number | null;

    @Column({ type: 'varchar', length: 50, default: UserRole.CONTRACTOR, name: 'target_role' })
    targetRole: UserRole;

    @Column({ type: 'varchar', length: 20, nullable: true, name: 'level' })
    level: Level;

    @Column({ type: 'integer', default: 0, name: 'max_cities' })
    maxCities: number;

    @Column({ type: 'integer', default: 0, name: 'max_reports' })
    maxReports: number;

    @Column({ type: 'integer', default: 0, name: 'max_properties' })
    maxProperties: number;

    @Column({ type: 'integer', default: 0, name: 'max_projects' })
    maxProjects: number;

    @Column({ type: 'boolean', default: false, name: 'is_unlimited_properties' })
    isUnlimitedProperties: boolean;

    @Column({ type: 'boolean', default: false, name: 'is_unlimited_projects' })
    isUnlimitedProjects: boolean;

    @Column({ type: 'boolean', default: false, name: 'is_unlimited_access' })
    isUnlimitedAccess: boolean;

    @Column({ type: 'jsonb' })
    features: Record<string, any>;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'integer', default: 0, name: 'max_users' })
    maxUsers: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}