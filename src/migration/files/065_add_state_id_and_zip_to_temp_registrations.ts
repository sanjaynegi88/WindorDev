import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE public.temp_registrations
    ADD COLUMN IF NOT EXISTS state_id uuid NULL,
    ADD COLUMN IF NOT EXISTS zip varchar(20) NULL;
  `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE public.temp_registrations
    DROP COLUMN IF EXISTS state_id,
    DROP COLUMN IF EXISTS zip;
  `);
}
