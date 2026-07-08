import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 008: Update billingCycle constraint to allow half-hourly...');
    
    try {
        // Drop the existing check constraint
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            DROP CONSTRAINT IF EXISTS "subscriptions_billingCycle_check"
        `);
        console.log('✅ Dropped existing billingCycle check constraint');
        
        // Add new check constraint that includes half-hourly
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            ADD CONSTRAINT "subscriptions_billingCycle_check" 
            CHECK ("billingCycle" IN ('monthly', 'annually', 'half-hourly'))
        `);
        console.log('✅ Added new billingCycle check constraint with half-hourly support');
        
    } catch (error) {
        console.log('⚠️ Error updating constraint:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 008 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 008...');
    
    // Drop the new constraint
    await queryRunner.query(`
        ALTER TABLE "subscriptions" 
        DROP CONSTRAINT IF EXISTS "subscriptions_billingCycle_check"
    `);
    
    // Add back the original constraint (only monthly and annually)
    await queryRunner.query(`
        ALTER TABLE "subscriptions" 
        ADD CONSTRAINT "subscriptions_billingCycle_check" 
        CHECK ("billingCycle" IN ('monthly', 'annually'))
    `);
    
    console.log('✅ Migration 008 rolled back successfully');
}