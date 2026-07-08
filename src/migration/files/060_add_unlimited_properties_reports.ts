import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.membership_plans
        ADD COLUMN IF NOT EXISTS is_unlimited_properties boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
        ALTER TABLE public.membership_plans
        ADD COLUMN IF NOT EXISTS is_unlimited_projects boolean NOT NULL DEFAULT false
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.membership_plans
        DROP COLUMN IF EXISTS is_unlimited_properties
    `);

    await queryRunner.query(`
        ALTER TABLE public.membership_plans
        DROP COLUMN IF EXISTS is_unlimited_projects
    `);
}
