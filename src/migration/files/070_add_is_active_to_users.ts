import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(`
        ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.users
        DROP COLUMN IF EXISTS is_active
    `);
}
