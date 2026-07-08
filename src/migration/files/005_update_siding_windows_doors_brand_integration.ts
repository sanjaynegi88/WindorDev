import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Updating siding and windows_doors tables for brand integration...');
    
    try {
        // Update siding table
        await queryRunner.query(`
            ALTER TABLE siding 
            ADD COLUMN brand_id UUID,
            ADD COLUMN custom_brand VARCHAR(255);
        `);
        
        await queryRunner.query(`
            ALTER TABLE siding 
            ADD CONSTRAINT fk_siding_brand 
            FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
        `);
        
        await queryRunner.query(`
            ALTER TABLE siding DROP COLUMN IF EXISTS brand;
        `);
        
        console.log('✅ Successfully updated siding table with brand integration');
        
        // Update windows_doors table
        await queryRunner.query(`
            ALTER TABLE windows_doors 
            ADD COLUMN brand_id UUID,
            ADD COLUMN custom_brand VARCHAR(255);
        `);
        
        await queryRunner.query(`
            ALTER TABLE windows_doors 
            ADD CONSTRAINT fk_windows_doors_brand 
            FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
        `);
        
        await queryRunner.query(`
            ALTER TABLE windows_doors DROP COLUMN IF EXISTS brand;
        `);
        
        console.log('✅ Successfully updated windows_doors table with brand integration');
        
    } catch (error: any) {
        console.error('❌ Failed to update tables:', error.message);
        throw error;
    }
    
    console.log('🎉 All component tables brand integration completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back siding and windows_doors tables brand integration...');
    
    try {
        // Rollback siding table
        await queryRunner.query(`
            ALTER TABLE siding ADD COLUMN brand VARCHAR(255);
        `);
        
        await queryRunner.query(`
            ALTER TABLE siding DROP CONSTRAINT IF EXISTS fk_siding_brand;
        `);
        
        await queryRunner.query(`
            ALTER TABLE siding 
            DROP COLUMN IF EXISTS brand_id,
            DROP COLUMN IF EXISTS custom_brand;
        `);
        
        console.log('✅ Successfully rolled back siding table');
        
        // Rollback windows_doors table
        await queryRunner.query(`
            ALTER TABLE windows_doors ADD COLUMN brand VARCHAR(255);
        `);
        
        await queryRunner.query(`
            ALTER TABLE windows_doors DROP CONSTRAINT IF EXISTS fk_windows_doors_brand;
        `);
        
        await queryRunner.query(`
            ALTER TABLE windows_doors 
            DROP COLUMN IF EXISTS brand_id,
            DROP COLUMN IF EXISTS custom_brand;
        `);
        
        console.log('✅ Successfully rolled back windows_doors table');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback tables:', error.message);
        throw error;
    }
    
    console.log('🎉 All component tables rollback completed successfully.');
}