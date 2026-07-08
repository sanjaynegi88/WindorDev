import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.audit_logs
        ADD COLUMN is_deleted boolean NOT NULL DEFAULT false,
        ADD COLUMN deleted_by_user_id uuid NULL,
        ADD COLUMN deleted_by_user_email character varying(255) NULL,
        ADD COLUMN deleted_by_user_role character varying(50) NULL,
        ADD COLUMN deleted_at timestamptz NULL
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.audit_logs
        DROP COLUMN deleted_at,
        DROP COLUMN deleted_by_user_role,
        DROP COLUMN deleted_by_user_email,
        DROP COLUMN deleted_by_user_id,
        DROP COLUMN is_deleted
    `);
}
