import { QueryRunner } from 'typeorm';

const tables = ['roofing', 'siding', 'windows', 'doors', 'garage_doors'];

export async function up(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor_id'
                ) THEN
                    ALTER TABLE public.${table}
                    RENAME COLUMN contractor TO contractor_id;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor_id'
                ) THEN
                    ALTER TABLE public.${table}
                    ADD COLUMN contractor_id character varying(255);
                END IF;
            END $$;
        `);
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor_id'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor'
                ) THEN
                    ALTER TABLE public.${table}
                    RENAME COLUMN contractor_id TO contractor;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'contractor'
                ) THEN
                    ALTER TABLE public.${table}
                    ADD COLUMN contractor character varying(255);
                END IF;
            END $$;
        `);
    }
}
