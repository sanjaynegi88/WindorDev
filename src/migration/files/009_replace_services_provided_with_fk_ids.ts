import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Add new column to store array of service UUIDs
        await queryRunner.query(`
            ALTER TABLE public.contractor_directory_profiles
            ADD COLUMN IF NOT EXISTS services_provided_ids JSONB NULL
        `);

        // Drop the old fixed-value column
        await queryRunner.query(`
            ALTER TABLE public.contractor_directory_profiles
            DROP COLUMN IF EXISTS services_provided
        `);
    },

    async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the old column
        await queryRunner.query(`
            ALTER TABLE public.contractor_directory_profiles
            ADD COLUMN IF NOT EXISTS services_provided JSONB NULL
        `);

        // Drop the new column
        await queryRunner.query(`
            ALTER TABLE public.contractor_directory_profiles
            DROP COLUMN IF EXISTS services_provided_ids
        `);
    },
};

export default migration;
