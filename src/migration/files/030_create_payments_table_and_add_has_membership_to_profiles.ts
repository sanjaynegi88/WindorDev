import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating payments table and adding has_membership to user_profiles...');
    
    try {
        // 1. Create payments table
        await queryRunner.query(`
            CREATE TABLE "payments" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "user_id" UUID NOT NULL,
                "subscription_id" UUID,
                "amount" DECIMAL(10,2) NOT NULL,
                "currency" VARCHAR(10) NOT NULL DEFAULT 'usd',
                "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
                "stripe_payment_intent_id" VARCHAR(255),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "FK_payments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_payments_subscription" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL,
                CONSTRAINT "CHK_payments_status" CHECK ("status" IN ('success', 'failed', 'pending'))
            )
        `);

        // 2. Add has_membership to user_profiles
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "has_membership" BOOLEAN DEFAULT false`);
        
        console.log('✅ Created payments table and added has_membership to user_profiles');
        
    } catch (error: any) {
        console.error('❌ Failed to run migration 030:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back migration 030...');
    
    try {
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "has_membership"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
        console.log('✅ Successfully rolled back migration 030');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback migration 030:', error.message);
        throw error;
    }
}
