import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Convert report_type column from enum to plain text
        await queryRunner.query(`
            ALTER TABLE public.reports
            ALTER COLUMN report_type TYPE TEXT
        `);

        // Update any existing WINDOW/DOOR values to WINDOW_DOOR
        await queryRunner.query(`
            UPDATE public.reports
            SET report_type = 'WINDOW_DOOR'
            WHERE report_type IN ('WINDOW', 'DOOR')
        `);

        // Drop old report_type enum if it exists
        await queryRunner.query(`
            DROP TYPE IF EXISTS report_type_enum CASCADE
        `);
    },
};

export default migration;
