import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToOne,
} from 'typeorm';
import { User } from './user.entity';

@Entity('contractor_directory_profiles')
export class ContractorDirectoryProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'contractor_id', unique: true })
    contractorId: string;

    @Column({ type: 'varchar', length: 255, name: 'company_name' })
    companyName: string;

    @Column({ type: 'varchar', length: 255, name: 'contact_name' })
    contactName: string;

    @Column({ type: 'varchar', length: 50 })
    phone: string;

    @Column({ type: 'varchar', length: 255 })
    email: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'website_url' })
    websiteUrl: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_logo' })
    companyLogo: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'jsonb', nullable: true, name: 'services_provided_ids' })
    servicesProvidedIds: string[] | null;

    @Column({ type: 'jsonb', name: 'selected_cities' })
    selectedCities: string[];

    @Column({ type: 'varchar', length: 20, name: 'membership_level' })
    membershipLevel: 'SILVER' | 'GOLD';

    @Column({ type: 'boolean', default: true, name: 'is_active' })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @OneToOne(() => User)
    @JoinColumn({ name: 'contractor_id' })
    contractor: User;
}