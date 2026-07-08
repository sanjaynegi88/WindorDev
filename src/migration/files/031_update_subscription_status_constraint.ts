import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Updating subscription status constraint to include INCOMPLETE...');
    
    try {
        // Drop the existing constraint
        console.log('🗑️ Dropping existing subscriptions_status_check constraint...');
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_status_check"`);
        console.log('✅ Dropped existing constraint');
        
        // Add the updated constraint with INCOMPLETE status
        console.log('📋 Adding updated constraint with INCOMPLETE status...');
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("status" IN ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'INCOMPLETE'))`);
        console.log('✅ Added updated constraint');
        
    } catch (error: any) {
        console.error('❌ Failed to run migration 031:', error.message);
        throw error;
    }
    
    console.log('🎉 Subscription status constraint update completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back subscription status constraint update...');
    
    try {
        // Drop the updated constraint
        console.log('🗑️ Dropping updated constraint...');
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_status_check"`);
        console.log('✅ Dropped updated constraint');
        
        // Restore the original constraint (without INCOMPLETE)
        console.log('🔄 Restoring original constraint...');
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK ("status" IN ('ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'))`);
        console.log('✅ Restored original constraint');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback migration 031:', error.message);
        throw error;
    }
    
    console.log('🎉 Subscription status constraint rollback completed successfully!');
}