import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure migrations tracking table exists
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS public.migrations (
                id   SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        // Add front_images column (single image URL)
        await queryRunner.query(`
            ALTER TABLE public.properties
            ADD COLUMN IF NOT EXISTS front_image TEXT DEFAULT NULL
        `);

        // Add other_images column (single image URL)
        await queryRunner.query(`
            ALTER TABLE public.properties
            ADD COLUMN IF NOT EXISTS other_image TEXT DEFAULT NULL
        `);
    },
};

export default migration;
