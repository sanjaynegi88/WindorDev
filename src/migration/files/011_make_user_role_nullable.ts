import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing default so we can alter the column
        await queryRunner.query(`
            ALTER TABLE public.users
            ALTER COLUMN role DROP DEFAULT
        `);

        // Make the role column nullable
        await queryRunner.query(`
            ALTER TABLE public.users
            ALTER COLUMN role DROP NOT NULL
        `);
    },

    async down(queryRunner: QueryRunner): Promise<void> {
        // Restore NOT NULL — backfill nulls first to avoid constraint violation
        await queryRunner.query(`
            UPDATE public.users
            SET role = 'PROPERTY_OWNER'
            WHERE role IS NULL
        `);

        await queryRunner.query(`
            ALTER TABLE public.users
            ALTER COLUMN role SET NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE public.users
            ALTER COLUMN role SET DEFAULT 'PROPERTY_OWNER'
        `);
    },
};

export default migration;
