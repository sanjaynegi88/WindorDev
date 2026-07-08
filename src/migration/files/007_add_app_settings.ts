import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS public.app_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                key VARCHAR(100) NOT NULL UNIQUE,
                value VARCHAR(255) NOT NULL,
                description TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed the report price (for reference only — not yet linked to working code)
        await queryRunner.query(`
            INSERT INTO public.app_settings (key, value, description)
            VALUES ('report_price', '69.00', 'Price in USD charged per individual report purchase')
            ON CONFLICT (key) DO NOTHING
        `);
    },
};

export default migration;
