import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE public.user_profiles
    DROP COLUMN IF EXISTS "phone_number",
    DROP COLUMN IF EXISTS "address";
  `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE public.user_profiles
    ADD COLUMN "phone_number" varchar(10) NULL UNIQUE,
    ADD COLUMN "address" text NULL;
  `);
}
