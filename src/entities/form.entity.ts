import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn
} from 'typeorm';
import { User } from './user.entity';

@Entity('forms')
export class UserForm {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'user_id', unique: true })
    userId: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', name: 'company_address', nullable: true })
    companyAddress: string;

    @Column({ type: 'varchar', name: 'website_url', nullable: true, unique: true })
    websiteUrl: string;

    @Column({ type: 'varchar', name: 'license_number', nullable: true })
    licenseNumber: string;

    @Column({ type: 'varchar', name: 'mobile_phone', nullable: true, unique: true })
    mobilePhone: string;

    @Column({ type: 'varchar', name: 'company_phone', nullable: true, unique: true })
    companyPhone: string;

    @Column({ type: 'varchar', name: 'property_address', nullable: true })
    propertyAddress: string;

    @Column({ type: 'date', name: 'owner_date_start', nullable: true })
    ownerDateStart: Date | null;

    @Column({ type: 'date', name: 'owner_date_end', nullable: true })
    ownerDateEnd: Date | null;

    @Column({ type: 'jsonb', name: 'service_types', nullable: true, default: [] })
    serviceTypes: string[];

    @Column({ type: 'varchar', length: 100, name: 'title', nullable: true })
    title: string;

    @Column({ type: 'varchar', length: 255, name: 'city_official', nullable: true })
    cityOfficial: string;

    @Column({ type: 'varchar', length: 255, name: 'city_address', nullable: true })
    cityAddress: string;

    @Column({ type: 'varchar', length: 20, name: 'city_phone', nullable: true })
    cityPhone: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
