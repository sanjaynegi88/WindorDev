import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    token: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'timestamp', nullable: true })
    expires_at: Date;

    @Column({ type: 'boolean', default: false })
    is_revoked: boolean;

    @CreateDateColumn()
    created_at: Date;
}
