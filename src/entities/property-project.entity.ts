import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Property } from './property.entity';
import { City } from './city.entity';

export enum ProjectType {
    // Contractor / Admin
    ROOFING = 'ROOFING',
    SIDING = 'SIDING',
    WINDOW_DOOR = 'WINDOW_DOOR',
    WINDOWS = 'WINDOWS',
    DOORS = 'DOORS',
    GARAGE_DOORS = 'GARAGE_DOORS',

    // Home Owner
    NEW_CABINETS = 'NEW_CABINETS',
    NEW_APPLIANCES = 'NEW_APPLIANCES',
    NEW_FURNACE = 'NEW_FURNACE',
    NEW_AC = 'NEW_AC',
    ADDED_ROOM = 'ADDED_ROOM',
    NEW_YARD_WORK = 'NEW_YARD_WORK',
    OTHER = 'OTHER'
}

export enum ProjectStatus {
    DRAFT = 'DRAFT',
    COMPLETE = 'COMPLETE',
}

@Entity('property_project')
export class PropertyProject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid', name: 'property_id' })
    property_id: string;

    @ManyToOne(() => Property, { nullable: false })
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column({ type: 'varchar', length: 255, name: 'project_name' })
    project_name: string;

    @Column({ 
        type: 'varchar', 
        length: 50, 
        name: 'project_type',
        transformer: {
            to: (value: string) => value?.toUpperCase(),
            from: (value: string) => value
        }
    })
    project_type: ProjectType;

    @Column({ type: 'date', nullable: true, name: 'date_of_install' })
    date_of_install: Date;

    @Column({ type: 'varchar', length: 50, nullable: true })
    permit: string | null;

    @Column({ type: 'boolean', name: 'need_permit', default: false })
    need_permit: boolean;

    @Column({ type: 'uuid', nullable: true, name: 'governing_city_id' })
    governing_city_id: string;

    @ManyToOne(() => City, { nullable: true })
    @JoinColumn({ name: 'governing_city_id' })
    governingCity: City;

    @Column({ 
        type: 'varchar', 
        length: 20, 
        name: 'project_status',
        default: ProjectStatus.DRAFT 
    })
    project_status: ProjectStatus;

    @Column({ type: 'uuid', nullable: true, name: 'contractor_id' })
    contractor_id: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'contractor_id' })
    contractor: User;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @Column({ type: 'uuid', name: 'created_by' })
    created_by: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'created_by' })
    createdBy: User;

    // --- Home Owner specific columns ---
    @Column({ 
        type: 'varchar', 
        length: 20, 
        name: 'visible_status', 
        default: 'public' 
    })
    visible_status: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    other: string | null;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}