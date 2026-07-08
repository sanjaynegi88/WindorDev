import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding updatedAt column to membership_plans table...');
    
    try {
        await queryRunner.query(`ALTER TABLE "membership_plans" ADD COLUMN "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log('✅ Added updatedAt column to membership_plans table');
        
    } catch (error: any) {
        console.error('❌ Failed to add updatedAt column:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back updatedAt column addition...');
    
    try {
        await queryRunner.query(`ALTER TABLE "membership_plans" DROP COLUMN "updatedAt"`);
        console.log('✅ Removed updatedAt column from membership_plans table');
        
    } catch (error: any) {
        console.error('❌ Failed to remove updatedAt column:', error.message);
        throw error;
    }
}
