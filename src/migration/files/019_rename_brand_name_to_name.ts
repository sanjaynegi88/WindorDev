import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner, firestore?: any): Promise<void> {
    console.log('🚀 Renaming brand_name to name in brands table...');
    
    try {
        // Just rename the column. PostgreSQL will keep the unique constraint on it.
        await queryRunner.query(`ALTER TABLE "brands" RENAME COLUMN "brand_name" TO "name"`);
        
        console.log('✅ Successfully renamed brand_name to name');
        
    } catch (error: any) {
        console.error('❌ Failed to rename brand_name to name:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner, firestore?: any): Promise<void> {
    console.log('⚠️ rolling back brand name rename...');
    
    try {
        await queryRunner.query(`ALTER TABLE "brands" RENAME COLUMN "name" TO "brand_name"`);
        console.log('✅ Successfully rolled back name to brand_name');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback brand name rename:', error.message);
        throw error;
    }
}
