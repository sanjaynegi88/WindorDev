import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting subscription system migration...');
    
    try {
        // Drop old memberships table
        console.log('🗑️ Dropping old memberships table...');
        await queryRunner.query(`DROP TABLE IF EXISTS "memberships" CASCADE`);
        console.log('✅ Dropped old memberships table');
        
        // Create membership_plans table
        console.log('📋 Creating membership_plans table...');
        await queryRunner.query(`
            CREATE TABLE "membership_plans" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(100) NOT NULL,
                "description" TEXT,
                "monthlyPriceId" VARCHAR(100) NOT NULL,
                "annualyPriceId" VARCHAR(100) NOT NULL,
                "monthlyAmount" DECIMAL(10,2) NOT NULL,
                "yearlyAmount" DECIMAL(10,2) NOT NULL,
                "features" JSONB NOT NULL DEFAULT '[]',
                "isActive" BOOLEAN DEFAULT true,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created membership_plans table');
        
        // Create subscriptions table
        console.log('💳 Creating subscriptions table...');
        await queryRunner.query(`
            CREATE TABLE "subscriptions" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "userId" UUID NOT NULL,
                "stripeCustomerId" VARCHAR NOT NULL,
                "stripeSubscriptionId" VARCHAR NOT NULL,
                "planId" UUID NOT NULL,
                "billingCycle" VARCHAR(20) NOT NULL CHECK ("billingCycle" IN ('monthly', 'annually')),
                "status" VARCHAR(20) NOT NULL CHECK ("status" IN ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED')),
                "currentPeriodEnd" TIMESTAMP NOT NULL,
                "gracePeriodEndsAt" TIMESTAMP,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE CASCADE
            )
        `);
        console.log('✅ Created subscriptions table');
        
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
    
    console.log('🎉 Subscription system migration completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back subscription system migration...');
    
    try {
        // Drop new tables
        await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions" CASCADE`);
        console.log('✅ Dropped subscriptions table');
        
        await queryRunner.query(`DROP TABLE IF EXISTS "membership_plans" CASCADE`);
        console.log('✅ Dropped membership_plans table');
        
        // Recreate old memberships table
        console.log('🔄 Recreating old memberships table...');
        await queryRunner.query(`
            CREATE TABLE "memberships" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "membership_name" VARCHAR(100) NOT NULL,
                "description" TEXT,
                "price_usd" DECIMAL(10,2) NOT NULL,
                "renewal_days" INTEGER NOT NULL,
                "features" JSONB,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Recreated old memberships table');
        
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
    
    console.log('🎉 Subscription system rollback completed successfully!');
}