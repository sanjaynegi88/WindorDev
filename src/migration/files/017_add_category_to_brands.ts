import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding category column to brands table...');
    
    try {
        // Create enum type first
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE brand_category_enum AS ENUM ('ROOFING', 'SIDING', 'WINDOW', 'DOOR');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Add column to brands table
        await queryRunner.query(`
            ALTER TABLE brands 
            ADD COLUMN category brand_category_enum DEFAULT 'ROOFING';
        `);
        
        console.log('✅ Successfully added category column to brands table');
        
    } catch (error: any) {
        console.error('❌ Failed to add category column to brands table:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back category column from brands table...');
    
    try {
        // Remove column
        await queryRunner.query(`ALTER TABLE brands DROP COLUMN IF EXISTS category;`);
        
        // Remove enum type
        await queryRunner.query(`DROP TYPE IF EXISTS brand_category_enum;`);
        
        console.log('✅ Successfully removed category column and enum type');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback category column:', error.message);
        throw error;
    }
}
