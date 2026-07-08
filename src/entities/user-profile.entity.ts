import {
    Entity,
    PrimaryColumn,
    Column,
    OneToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_profiles')
export class UserProfile {
    @PrimaryColumn('uuid')
    user_id: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 255, nullable: true })
    display_name: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    company_name: string;

    @Column({ type: 'text', nullable: true })
    profile_image_url: string;

    @Column({ type: 'uuid', nullable: true })
    current_subscription_id: string | null;

    @Column({ type: 'boolean', default: false })
    has_membership: boolean;

    @Column({ type: 'boolean', default: false })
    is_directory: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
