import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Property } from './property.entity';
import { PropertyProject } from './property-project.entity';
import { Report } from './report.entity';
import { Brand } from './brand.entity';
import { User } from './user.entity';

@Entity('owner_projects')
export class OwnerProject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'property_id' })
    property_id: string;

    @ManyToOne(() => Property, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ type: 'uuid', name: 'project_id' })
    project_id: string;

    @ManyToOne(() => PropertyProject, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: PropertyProject;

    @Column({ type: 'uuid', nullable: true, name: 'report_id' })
    report_id: string | null;

    @ManyToOne(() => Report, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'report_id' })
    report: Report | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    brand: string | null;

    @Column({ type: 'uuid', nullable: true, name: 'brand_id' })
    brand_id: string | null;

    @ManyToOne(() => Brand, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'brand_id' })
    brandEntity: Brand | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    other_brand: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    installer: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    supplier: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'date', nullable: true })
    install_date: Date | null;


    @Column({ type: 'integer', default: 1 })
    version: number;

    @Column({ type: 'uuid', nullable: true, name: 'root_id' })
    root_id: string | null;

    @Column({ type: 'boolean', default: true, name: 'is_latest' })
    is_latest: boolean;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;

    @Column({ type: 'varchar', length: 30, nullable: true })
    permit_status: string | null;

    @Column({ type: 'timestamp', nullable: true })
    permit_uploaded_at: Date | null;
}
