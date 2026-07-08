import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE public.user_profiles
            ADD COLUMN IF NOT EXISTS is_directory BOOLEAN NOT NULL DEFAULT FALSE
        `);

        // Backfill: set is_directory = true for contractors with an ACTIVE STANDARD or PREMIUM subscription
        await queryRunner.query(`
            UPDATE public.user_profiles up
            SET is_directory = TRUE
            FROM public.subscriptions s
            JOIN public.membership_plans mp ON mp.id = s."planId"
            WHERE s."userId" = up.user_id
              AND s.status = 'ACTIVE'
              AND mp.contractor_level IN ('STANDARD', 'PREMIUM')
        `);
    },
};

export default migration;
