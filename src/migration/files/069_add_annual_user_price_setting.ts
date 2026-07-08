import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    // Insert add_user_price_annual setting (same pattern as add_user_price)
    await queryRunner.query(`
        INSERT INTO public.app_settings (id, key, value, created_at, updated_at)
        VALUES (gen_random_uuid(), 'add_user_price_annual', '300.00', now(), now())
        ON CONFLICT (key) DO NOTHING
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DELETE FROM public.app_settings WHERE key = 'add_user_price_annual'
    `);
}
