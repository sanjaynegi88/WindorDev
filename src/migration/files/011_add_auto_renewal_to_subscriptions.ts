import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 011: Add auto_renewal_enabled to subscriptions...');
    
    try {
        // Add auto_renewal_enabled column to subscriptions table
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            ADD COLUMN "auto_renewal_enabled" BOOLEAN NOT NULL DEFAULT true
        `);
        console.log('✅ Added auto_renewal_enabled column to subscriptions table');
        
        // Update existing subscriptions to have auto-renewal enabled by default
        const result = await queryRunner.query(`
            UPDATE "subscriptions" 
            SET "auto_renewal_enabled" = true 
            WHERE "auto_renewal_enabled" IS NULL
        `);
        console.log(`✅ Updated ${result.affectedRows || 0} existing subscriptions with auto-renewal enabled`);
        
    } catch (error) {
        console.log('⚠️ Error in migration 011:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 011 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 011...');
    
    try {
        // Remove auto_renewal_enabled column
        await queryRunner.query(`
            ALTER TABLE "subscriptions" 
            DROP COLUMN IF EXISTS "auto_renewal_enabled"
        `);
        console.log('✅ Removed auto_renewal_enabled column from subscriptions table');
        
    } catch (error) {
        console.log('⚠️ Error rolling back migration 011:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 011 rolled back successfully');
}