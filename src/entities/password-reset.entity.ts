import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('password_resets')
export class PasswordReset {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    email: string;

    @Column({ type: 'varchar', length: 6 })
    otp: string;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @Column({ type: 'boolean', default: false })
    is_used: boolean;

    @Column({ type: 'boolean', default: false })
    is_verified: boolean;

    @Column({ type: 'uuid', nullable: true })
    reset_token: string;

    @CreateDateColumn()
    created_at: Date;
}
