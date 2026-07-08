import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Report } from './report.entity';
import { Property } from './property.entity';
import { PropertyProject } from './property-project.entity';

@Entity('windows')
export class Windows {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    property_id: string;

    @ManyToOne(() => Property)
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ type: 'uuid', nullable: true, name: 'project_id' })
    project_id: string | null;

    @ManyToOne(() => PropertyProject, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'project_id' })
    project: PropertyProject | null;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'contractor_id' })
    contractor_id: string | null;

    @Column({ nullable: true })
    report_id: string | null;

    @ManyToOne(() => Report)
    @JoinColumn({ name: 'report_id' })
    report: Report;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'date', nullable: true })
    install_date: Date;

    @Column({ length: 255, nullable: true })
    supplier: string;

    @Column({ length: 255, nullable: true })
    installer: string;

    @Column({ length: 255, nullable: true })
    brand: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    manufacturer: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    where_install: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    other_brand: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    material: string | null;

    @Column({ type: 'varchar', nullable: true })
    u_factor: string | null;

    @Column({ length: 255, nullable: true })
    production_line: string;

    @Column({ length: 255, nullable: true })
    order_number: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ type: 'varchar', length: 30, nullable: true })
    permit_status: string | null;

    @Column({ type: 'timestamp', nullable: true })
    permit_uploaded_at: Date | null;

    // ── Versioning ────────────────────────────────────────────────────────────
    @Column({ type: 'integer', default: 1 })
    version: number;

    @Column({ type: 'uuid', nullable: true, name: 'root_id' })
    rootId: string | null;

    @Column({ type: 'boolean', default: true, name: 'is_latest' })
    isLatest: boolean;
}
