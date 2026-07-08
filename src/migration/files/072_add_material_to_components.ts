import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    const tables = ['windows', 'doors', 'garage_doors'];

    for (const table of tables) {
        await queryRunner.query(`
            ALTER TABLE public.${table}
            ADD COLUMN IF NOT EXISTS material character varying(255)
        `);
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    const tables = ['windows', 'doors', 'garage_doors'];

    for (const table of tables) {
        await queryRunner.query(`
            ALTER TABLE public.${table}
            DROP COLUMN IF EXISTS material
        `);
    }
}
