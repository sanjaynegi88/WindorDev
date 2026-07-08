import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 015: Add paywall fields to user_report_usage...');

    const isFreExists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_report_usage' AND column_name = 'is_free'
    `);
    if (isFreExists.length === 0) {
        await queryRunner.query(`ALTER TABLE "user_report_usage" ADD COLUMN "is_free" BOOLEAN NOT NULL DEFAULT false;`);
        console.log('✅ Added is_free column');
    } else {
        console.log('⚠️ is_free already exists, skipping...');
    }

    const priceChargedExists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_report_usage' AND column_name = 'price_charged'
    `);
    if (priceChargedExists.length === 0) {
        await queryRunner.query(`ALTER TABLE "user_report_usage" ADD COLUMN "price_charged" DECIMAL(10,2) NOT NULL DEFAULT 0;`);
        console.log('✅ Added price_charged column');
    } else {
        console.log('⚠️ price_charged already exists, skipping...');
    }

    const paymentIntentIdExists = await queryRunner.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_report_usage' AND column_name = 'payment_intent_id'
    `);
    if (paymentIntentIdExists.length === 0) {
        await queryRunner.query(`ALTER TABLE "user_report_usage" ADD COLUMN "payment_intent_id" VARCHAR NULL;`);
        console.log('✅ Added payment_intent_id column');
    } else {
        console.log('⚠️ payment_intent_id already exists, skipping...');
    }

    const constraintExists = await queryRunner.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'user_report_usage'
        AND constraint_name = 'UQ_user_report_usage_user_report_period'
    `);
    if (constraintExists.length === 0) {
        await queryRunner.query(`
            ALTER TABLE "user_report_usage"
            ADD CONSTRAINT "UQ_user_report_usage_user_report_period"
            UNIQUE ("user_id", "report_id", "billing_period_start");
        `);
        console.log('✅ Added UNIQUE constraint');
    } else {
        console.log('⚠️ UNIQUE constraint already exists, skipping...');
    }

    console.log('🎉 Migration 015 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 015...');
    await queryRunner.query(`ALTER TABLE "user_report_usage" DROP CONSTRAINT IF EXISTS "UQ_user_report_usage_user_report_period";`);
    await queryRunner.query(`ALTER TABLE "user_report_usage" DROP COLUMN IF EXISTS "payment_intent_id";`);
    await queryRunner.query(`ALTER TABLE "user_report_usage" DROP COLUMN IF EXISTS "price_charged";`);
    await queryRunner.query(`ALTER TABLE "user_report_usage" DROP COLUMN IF EXISTS "is_free";`);
    console.log('✅ Migration 015 rolled back successfully');
}
