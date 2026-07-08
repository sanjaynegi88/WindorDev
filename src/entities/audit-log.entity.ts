import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50 })
    table_name: string;

    @Column({ type: 'varchar', length: 255 })
    record_id: string;

    @Column({ type: 'varchar', length: 20 })
    action: string;

    @Column({ type: 'jsonb', nullable: true })
    old_values: any;

    @Column({ type: 'jsonb', nullable: true })
    new_values: any;

    @Column({ type: 'varchar', length: 255 })
    changed_by_user_id: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    changed_by_user_email: string | null;

    @Column({ type: 'text', nullable: true })
    change_reason: string;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;

    @Column({ type: 'text', nullable: true })
    user_agent: string;

    @Column({ type: 'boolean', default: false })
    is_deleted: boolean;

    @Column({ type: 'uuid', nullable: true })
    deleted_by_user_id: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    deleted_by_user_email: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    deleted_by_user_role: string | null;

    @Column({ type: 'timestamptz', nullable: true })
    deleted_at: Date | null;

    @CreateDateColumn()
    created_at: Date;
}