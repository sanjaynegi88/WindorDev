export async function up(queryRunner, firestore) {
    console.log('🚀 Starting migration 010: Remove half-hourly support and unused tables...');
    
    try {
        // First, update any existing half-hourly subscriptions to monthly (BEFORE adding constraint)
        const result = await queryRunner.query(`UPDATE "subscriptions" SET "billingCycle" = 'monthly' WHERE "billingCycle" = 'half-hourly'`);
        console.log(`✅ Updated ${result.affectedRows || 0} half-hourly subscriptions to monthly`);
        
        // Remove half_hourly_amount and half_hourly_price_id columns
        await queryRunner.query(`ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "half_hourly_amount"`);
        console.log('✅ Dropped half_hourly_amount column');
        
        await queryRunner.query(`ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "half_hourly_price_id"`);
        console.log('✅ Dropped half_hourly_price_id column');
        
        // Update billing_cycle constraint to only allow monthly and annually
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_billingCycle_check"`);
        console.log('✅ Dropped existing billingCycle constraint');
        
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            ADD CONSTRAINT "subscriptions_billingCycle_check" 
            CHECK ("billingCycle" IN ('monthly', 'annually'))
        `);
        console.log('✅ Added new billingCycle constraint (monthly, annually only)');
        
        // Remove unused stripe_events table
        await queryRunner.query(`DROP TABLE IF EXISTS "stripe_events"`);
        console.log('✅ Dropped unused stripe_events table');
        
    } catch (error) {
        console.log('⚠️ Error in migration 010:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 010 completed successfully!');
}

export async function down(queryRunner, firestore) {
    console.log('🔄 Rolling back migration 010...');
    
    // Add back half_hourly_amount and half_hourly_price_id columns
    await queryRunner.query(`ALTER TABLE "membership_plans" ADD COLUMN "half_hourly_amount" DECIMAL(10,2) DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "membership_plans" ADD COLUMN "half_hourly_price_id" VARCHAR(255) DEFAULT 'free'`);
    
    // Restore original billing_cycle constraint
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_billingCycle_check"`);
    await queryRunner.query(`
        ALTER TABLE "subscriptions" 
        ADD CONSTRAINT "subscriptions_billingCycle_check" 
        CHECK ("billingCycle" IN ('monthly', 'annually', 'half-hourly'))
    `);
    
    // Recreate stripe_events table
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "stripe_events" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "stripe_event_id" VARCHAR UNIQUE NOT NULL,
            "event_type" VARCHAR(100) NOT NULL,
            "payload" JSONB NOT NULL,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Migration 010 rolled back successfully');
}