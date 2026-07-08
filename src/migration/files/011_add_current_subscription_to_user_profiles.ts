import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding current_subscription_id to user_profiles table...');
    
    try {
        // Add current_subscription_id column to user_profiles table
        console.log('📋 Adding current_subscription_id column...');
        await queryRunner.query(`
            ALTER TABLE "user_profiles" 
            ADD COLUMN "current_subscription_id" UUID NULL
        `);
        console.log('✅ Added current_subscription_id column to user_profiles');
        
        // Add foreign key constraint (optional, but recommended)
        console.log('🔗 Adding foreign key constraint...');
        await queryRunner.query(`
            ALTER TABLE "user_profiles" 
            ADD CONSTRAINT "FK_user_profiles_current_subscription" 
            FOREIGN KEY ("current_subscription_id") 
            REFERENCES "subscriptions"("id") 
            ON DELETE SET NULL
        `);
        console.log('✅ Added foreign key constraint');
        
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
    
    console.log('🎉 User profiles subscription migration completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back user profiles subscription migration...');
    
    try {
        // Drop foreign key constraint first
        console.log('🔗 Dropping foreign key constraint...');
        await queryRunner.query(`
            ALTER TABLE "user_profiles" 
            DROP CONSTRAINT IF EXISTS "FK_user_profiles_current_subscription"
        `);
        console.log('✅ Dropped foreign key constraint');
        
        // Drop the column
        console.log('📋 Dropping current_subscription_id column...');
        await queryRunner.query(`
            ALTER TABLE "user_profiles" 
            DROP COLUMN IF EXISTS "current_subscription_id"
        `);
        console.log('✅ Dropped current_subscription_id column');
        
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
    
    console.log('🎉 User profiles subscription rollback completed successfully!');
}