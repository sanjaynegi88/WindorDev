import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop component_type column from windows_doors table
        await queryRunner.query(`
            ALTER TABLE public.windows_doors
            DROP COLUMN IF EXISTS component_type
        `);

        // 2. Convert category column to plain text first (detach from old enum)
        await queryRunner.query(`
            ALTER TABLE public.brands
            ALTER COLUMN category TYPE VARCHAR(50)
        `);

        // 3. Drop old enum type
        await queryRunner.query(`
            DROP TYPE IF EXISTS brand_category_enum CASCADE
        `);

        // 4. Now update old WINDOW/DOOR values to WINDOW_DOOR (safe — column is plain text now)
        await queryRunner.query(`
            UPDATE public.brands
            SET category = 'WINDOW_DOOR'
            WHERE category IN ('WINDOW', 'DOOR')
        `);

        // 5. Create new enum with 3 values
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_category_enum') THEN
                    CREATE TYPE brand_category_enum AS ENUM ('ROOFING', 'SIDING', 'WINDOW_DOOR');
                END IF;
            END $$
        `);

        // 6. Cast column back to new enum
        await queryRunner.query(`
            ALTER TABLE public.brands
            ALTER COLUMN category TYPE brand_category_enum
            USING category::brand_category_enum
        `);
    },
};

export default migration;
