import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.doors
        ADD COLUMN IF NOT EXISTS door_code character varying(255)
    `);

    await queryRunner.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'roofing' AND column_name = 'where_installer'
            ) THEN
                ALTER TABLE public.roofing RENAME COLUMN where_installer TO where_install;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'siding' AND column_name = 'where_installer'
            ) THEN
                ALTER TABLE public.siding RENAME COLUMN where_installer TO where_install;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'windows' AND column_name = 'where_installer'
            ) THEN
                ALTER TABLE public.windows RENAME COLUMN where_installer TO where_install;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'doors' AND column_name = 'where_installer'
            ) THEN
                ALTER TABLE public.doors RENAME COLUMN where_installer TO where_install;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'garage_doors' AND column_name = 'where_installer'
            ) THEN
                ALTER TABLE public.garage_doors RENAME COLUMN where_installer TO where_install;
            END IF;
        END $$;
    `);

}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'garage_doors' AND column_name = 'where_install'
            ) THEN
                ALTER TABLE public.garage_doors RENAME COLUMN where_install TO where_installer;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'doors' AND column_name = 'where_install'
            ) THEN
                ALTER TABLE public.doors RENAME COLUMN where_install TO where_installer;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'windows' AND column_name = 'where_install'
            ) THEN
                ALTER TABLE public.windows RENAME COLUMN where_install TO where_installer;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'siding' AND column_name = 'where_install'
            ) THEN
                ALTER TABLE public.siding RENAME COLUMN where_install TO where_installer;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'roofing' AND column_name = 'where_install'
            ) THEN
                ALTER TABLE public.roofing RENAME COLUMN where_install TO where_installer;
            END IF;
        END $$;
    `);

    await queryRunner.query(`
        ALTER TABLE public.doors
        DROP COLUMN IF EXISTS door_code
    `);
}
