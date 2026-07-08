import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    
    // Add brand to garage_doors
    await queryRunner.query(`
        ALTER TABLE public.garage_doors
        ADD COLUMN IF NOT EXISTS brand character varying(255)
    `);

    // Add manufacturer and where_installer to all component tables
    const tables = ['roofing', 'siding', 'windows', 'doors', 'garage_doors'];
    
    for (const table of tables) {
        await queryRunner.query(`
            ALTER TABLE public.${table}
            ADD COLUMN IF NOT EXISTS manufacturer character varying(255),
            ADD COLUMN IF NOT EXISTS where_installer character varying(255)
        `);
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    const tables = ['roofing', 'siding', 'windows', 'doors', 'garage_doors'];
    
    for (const table of tables) {
        await queryRunner.query(`
            ALTER TABLE public.${table}
            DROP COLUMN IF EXISTS manufacturer,
            DROP COLUMN IF EXISTS where_installer
        `);
    }

    await queryRunner.query(`
        ALTER TABLE public.garage_doors
        DROP COLUMN IF EXISTS brand
    `);
}
