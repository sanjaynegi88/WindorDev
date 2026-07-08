import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Add max_properties column — how many properties a contractor can create
        await queryRunner.query(`
            ALTER TABLE public.membership_plans
            ADD COLUMN IF NOT EXISTS max_properties INTEGER NOT NULL DEFAULT 0
        `);
    },
};

export default migration;
