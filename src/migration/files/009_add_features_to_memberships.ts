import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding features column to memberships table...');
    
    try {
        await queryRunner.query(`ALTER TABLE "memberships" ADD COLUMN "features" JSONB`);
        console.log('✅ Added features JSONB column to memberships table');
        
    } catch (error: any) {
        console.error('❌ Failed to add features column:', error.message);
        throw error;
    }
    
    console.log('🎉 Features column added successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back features column addition...');
    
    try {
        await queryRunner.query(`ALTER TABLE "memberships" DROP COLUMN "features"`);
        console.log('✅ Removed features column from memberships table');
        
    } catch (error: any) {
        console.error('❌ Failed to remove features column:', error.message);
        throw error;
    }
    
    console.log('🎉 Features column rollback completed successfully.');
}