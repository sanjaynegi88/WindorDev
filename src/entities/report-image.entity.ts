import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Report } from './report.entity';
import { OwnerProject } from './owner-project.entity';

@Entity('report_images')
export class ReportImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    component_id: string;

    @Column({ type: 'uuid', nullable: true, name: 'owner_project_id' })
    owner_project_id: string | null;

    @ManyToOne(() => OwnerProject, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'owner_project_id' })
    ownerProject: OwnerProject | null;

    @Column('text', { nullable: true })
    image_url: string | null;

    @Column({ type: 'text', nullable: true })
    thumbnail_url: string;

    @Column({ length: 50, nullable: true })
    component_type: string;

    @Column({ type: 'text', nullable: true })
    property_owner_files: string | null;

    @Column({ type: 'boolean', default: false })
    owner_uploaded: boolean;

    @Column({ type: 'varchar', length: 100, nullable: true })
    image_category: string | null;

    @CreateDateColumn()
    created_at: Date;
}
