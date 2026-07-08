import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE public.properties
            ADD COLUMN IF NOT EXISTS unique_verification_id VARCHAR(255) DEFAULT NULL
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_unique_verification_id
            ON public.properties(unique_verification_id)
            WHERE unique_verification_id IS NOT NULL
        `);
    },
};

export default migration;
