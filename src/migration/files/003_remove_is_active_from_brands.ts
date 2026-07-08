import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Removing is_active column from brands table...');
    
    try {
        // Remove is_active column from brands table
        await queryRunner.query(`
            ALTER TABLE brands DROP COLUMN IF EXISTS is_active;
        `);
        
        console.log('✅ Successfully removed is_active column from brands table');
        
    } catch (error: any) {
        console.error('❌ Failed to remove is_active column:', error.message);
        throw error;
    }
    
    console.log('🎉 Brands table column removal completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back - adding is_active column to brands table...');
    
    try {
        // Add back is_active column with default value
        await queryRunner.query(`
            ALTER TABLE brands ADD COLUMN is_active BOOLEAN DEFAULT true;
        `);
        
        console.log('✅ Successfully added back is_active column to brands table');
        
    } catch (error: any) {
        console.error('❌ Failed to add back is_active column:', error.message);
        throw error;
    }
    
    console.log('🎉 Brands table column rollback completed successfully.');
}