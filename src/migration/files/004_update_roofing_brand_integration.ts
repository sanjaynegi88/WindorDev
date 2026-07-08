import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Updating roofing table for brand integration...');
    
    try {
        // Add brand_id column (foreign key to brands table)
        await queryRunner.query(`
            ALTER TABLE roofing 
            ADD COLUMN brand_id UUID,
            ADD COLUMN custom_brand VARCHAR(255);
        `);
        
        // Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE roofing 
            ADD CONSTRAINT fk_roofing_brand 
            FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
        `);
        
        // Remove old brand column
        await queryRunner.query(`
            ALTER TABLE roofing DROP COLUMN IF EXISTS brand;
        `);
        
        console.log('✅ Successfully updated roofing table with brand integration');
        
    } catch (error: any) {
        console.error('❌ Failed to update roofing table:', error.message);
        throw error;
    }
    
    console.log('🎉 Roofing table brand integration completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back roofing table brand integration...');
    
    try {
        // Add back old brand column
        await queryRunner.query(`
            ALTER TABLE roofing ADD COLUMN brand VARCHAR(255);
        `);
        
        // Remove foreign key constraint
        await queryRunner.query(`
            ALTER TABLE roofing DROP CONSTRAINT IF EXISTS fk_roofing_brand;
        `);
        
        // Remove new columns
        await queryRunner.query(`
            ALTER TABLE roofing 
            DROP COLUMN IF EXISTS brand_id,
            DROP COLUMN IF EXISTS custom_brand;
        `);
        
        console.log('✅ Successfully rolled back roofing table brand integration');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback roofing table:', error.message);
        throw error;
    }
    
    console.log('🎉 Roofing table rollback completed successfully.');
}