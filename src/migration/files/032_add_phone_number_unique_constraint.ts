import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Updating phone_number field with unique constraint and 10-digit length...');
    
    try {
        // 1. Clean up duplicate phone numbers first
        console.log('🧹 Cleaning up duplicate phone numbers...');
        await queryRunner.query(`
            UPDATE "user_profiles" 
            SET "phone_number" = NULL 
            WHERE "phone_number" IN (
                SELECT "phone_number" 
                FROM "user_profiles" 
                WHERE "phone_number" IS NOT NULL 
                GROUP BY "phone_number" 
                HAVING COUNT(*) > 1
            )
        `);
        console.log('✅ Cleaned up duplicate phone numbers');
        
        // 2. Update phone_number column length to 10
        console.log('📏 Updating phone_number column length to 10...');
        await queryRunner.query(`ALTER TABLE "user_profiles" ALTER COLUMN "phone_number" TYPE VARCHAR(10)`);
        console.log('✅ Updated phone_number column length');
        
        // 3. Add unique constraint to phone_number
        console.log('🔒 Adding unique constraint to phone_number...');
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD CONSTRAINT "UQ_user_profiles_phone_number" UNIQUE ("phone_number")`);
        console.log('✅ Added unique constraint to phone_number');
        
    } catch (error: any) {
        console.error('❌ Failed to run migration 032:', error.message);
        throw error;
    }
    
    console.log('🎉 Phone number unique constraint migration completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back phone number unique constraint migration...');
    
    try {
        // Drop unique constraint
        console.log('🗑️ Dropping unique constraint from phone_number...');
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP CONSTRAINT IF EXISTS "UQ_user_profiles_phone_number"`);
        console.log('✅ Dropped unique constraint');
        
        // Revert phone_number column length to 20
        console.log('🔄 Reverting phone_number column length to 20...');
        await queryRunner.query(`ALTER TABLE "user_profiles" ALTER COLUMN "phone_number" TYPE VARCHAR(20)`);
        console.log('✅ Reverted phone_number column length');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback migration 032:', error.message);
        throw error;
    }
    
    console.log('🎉 Phone number unique constraint rollback completed successfully!');
}