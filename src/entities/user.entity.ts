import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    ManyToOne,
    OneToMany,
    JoinColumn
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { City } from './city.entity';
import { State } from './state.entity';
import { Role } from './role.entity';

export enum UserRole {
    CONTRACTOR = 'CONTRACTOR',
    MANUFACTURER = 'MANUFACTURER',
    REALTOR = 'REALTOR',
    PROPERTY_OWNER = 'PROPERTY_OWNER',
    CITY_INSPECTOR = 'CITY_INSPECTOR',
    INSURANCE_COMPANY = 'INSURANCE_COMPANY',
    ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true, nullable: true })
    firebase_uid: string;

    @Column({ type: 'varchar', unique: true })
    email: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    first_name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    last_name: string;

    @Column({ type: 'uuid', nullable: true, name: 'role_id' })
    role_id: string | null;

    @ManyToOne(() => Role, { nullable: true, eager: true })
    @JoinColumn({ name: 'role_id' })
    roleEntity: Role | null;

    // Virtual getter — keeps all existing code that reads user.role working unchanged
    get role(): string | null {
        return this.roleEntity?.role_name ?? null;
    }

    @Column({ type: 'uuid', nullable: true })
    state_id: string;

    @ManyToOne(() => State, { nullable: true })
    @JoinColumn({ name: 'state_id' })
    state: State;

    @Column({ type: 'uuid', nullable: true })
    city_id: string;

    @ManyToOne(() => City)
    @JoinColumn({ name: 'city_id' })
    city: City;

    @Column({ type: 'boolean', default: false })
    sub_account: boolean;

    @Column({ type: 'varchar', length: 20, nullable: true })
    zip: string | null;

    @Column({ type: 'uuid', nullable: true })
    parent_id: string;

    @ManyToOne(() => User, user => user.sub_accounts)
    @JoinColumn({ name: 'parent_id' })
    parent: User;

    @OneToMany(() => User, user => user.parent)
    sub_accounts: User[];

    @OneToOne(() => UserProfile, profile => profile.user)
    profile: UserProfile;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
