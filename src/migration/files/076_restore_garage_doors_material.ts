import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.garage_doors
        ADD COLUMN IF NOT EXISTS order_number character varying(255)
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.garage_doors
        DROP COLUMN IF EXISTS order_number
    `);
}
