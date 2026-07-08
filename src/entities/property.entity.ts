import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { City } from './city.entity';
import { State } from './state.entity';
import { PropertyType } from './property-type.entity';
import { PropertyProject } from './property-project.entity';

@Entity('properties')
export class Property {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text', nullable: true })
    address: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    address2: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    property_name: string | null;

    @Column({ type: 'varchar', length: 100,  nullable: false })
    parcel_id: string;

    @Column({ type: 'uuid', nullable: true })
    property_type_id: string | null;

    @ManyToOne(() => PropertyType, { nullable: true, eager: false })
    @JoinColumn({ name: 'property_type_id' })
    property_type: PropertyType | null;

    @Column({ type: 'integer', nullable: true })
    yearbuilt: number | null;

    @Column({ type: 'integer', nullable: true })
    square_foot: number | null;

    @ManyToOne(() => City)
    @JoinColumn({ name: 'city_id' })
    city: City;

    @Column({ type: 'varchar', length: 50, nullable: true })
    zip: string | null;

    @Column({ type: 'uuid', nullable: true })
    city_id: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    city_name: string | null;

    @ManyToOne(() => State)
    @JoinColumn({ name: 'state_id' })
    state: State;

    @Column({ type: 'uuid', nullable: true })
    state_id: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    state_name: string | null;

    @Column('decimal', { precision: 10, scale: 7, nullable: true })
    latitude: number | null;

    @Column('decimal', { precision: 10, scale: 7, nullable: true })
    longitude: number | null;

    @Column({ type: 'uuid', nullable: true })
    property_owner_id: string | null;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'property_owner_id' })
    property_owner: User;

    @Column({ nullable: true })
    created_by: string | null;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @Column({ type: 'uuid', nullable: true })
    contractor_id: string | null;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'contractor_id' })
    contractor: User;

    @Column({ default: false })
    has_report: boolean;

    @Column({ default: false })
    verified_status: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
    unique_verification_id: string | null;

    @Column({ type: 'text', nullable: true })
    front_image: string | null;

    @Column({ type: 'text', nullable: true })
    other_image: string | null;

    @OneToMany(() => PropertyProject, propertyProject => propertyProject.property)
    projects: PropertyProject[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
