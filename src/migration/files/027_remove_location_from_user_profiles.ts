import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Removing city, state, and zip columns from user_profiles table...');
    
    try {
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "zip"`);
        console.log('✅ Removed location columns from user_profiles table');
        
    } catch (error: any) {
        console.error('❌ Failed to remove location columns:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ rolling back user_profiles column removal...');
    
    try {
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "city" VARCHAR(100)`);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "state" VARCHAR(100)`);
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "zip" VARCHAR(20)`);
        console.log('✅ Re-added location columns to user_profiles table');
        
    } catch (error: any) {
        console.error('❌ Failed to re-add location columns:', error.message);
        throw error;
    }
}
