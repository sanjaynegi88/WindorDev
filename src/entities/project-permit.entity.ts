import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { PropertyProject } from './property-project.entity';
import { Property } from './property.entity';
import { User } from './user.entity';

export enum ProjectPermitStatus {
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED',
}

export enum PermitUploaderRole {
    PROPERTY_OWNER = 'PROPERTY_OWNER',
    INSPECTOR = 'INSPECTOR',
}

@Entity('project_permits')
export class ProjectPermit {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'project_id' })
    project_id: string;

    @ManyToOne(() => PropertyProject, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: PropertyProject;

    @Column({ type: 'uuid', name: 'property_id' })
    property_id: string;

    @ManyToOne(() => Property, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ type: 'uuid', name: 'uploaded_by' })
    uploaded_by: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'uploaded_by' })
    uploader: User;

    @Column({ type: 'varchar', length: 30, name: 'uploader_role' })
    uploader_role: PermitUploaderRole;

    @Column({ type: 'text', name: 'file_path' })
    file_path: string;

    @Column({ type: 'varchar', length: 30 })
    status: ProjectPermitStatus;

    @Column({ type: 'uuid', nullable: true, name: 'verified_by' })
    verified_by: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'verified_by' })
    verifier: User | null;

    @Column({ type: 'timestamp', nullable: true, name: 'verified_at' })
    verified_at: Date | null;

    @CreateDateColumn({ name: 'uploaded_at' })
    uploaded_at: Date;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'boolean', default: true, name: 'is_current' })
    is_current: boolean;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}
