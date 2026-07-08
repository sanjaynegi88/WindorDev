import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Updating brand_category_enum: ROOF -> ROOFING (Safe Strategy)...');
    
    try {
        // 1. Change the column to VARCHAR temporarily to avoid enum constraints
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category TYPE VARCHAR(255)`);
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category DROP DEFAULT`);

        // 2. Drop the old enum type
        await queryRunner.query(`DROP TYPE IF EXISTS brand_category_enum`);

        // 3. Create the new enum type with correct values
        await queryRunner.query(`CREATE TYPE brand_category_enum AS ENUM ('ROOFING', 'SIDING', 'WINDOW', 'DOOR')`);

        // 4. Update the records and convert the column back to the new enum
        await queryRunner.query(`UPDATE brands SET category = 'ROOFING' WHERE category = 'ROOF'`);
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category TYPE brand_category_enum USING category::brand_category_enum`);
        
        // 5. Set the new default
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category SET DEFAULT 'ROOFING'`);
        
        console.log('✅ Successfully updated brand_category_enum to include ROOFING and updated records');
        
    } catch (error: any) {
        console.error('❌ Failed to update brand_category_enum:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ rolling back brand_category_enum update...');
    
    try {
        // Revert default and records
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category TYPE VARCHAR(255)`);
        await queryRunner.query(`DROP TYPE IF EXISTS brand_category_enum`);
        await queryRunner.query(`CREATE TYPE brand_category_enum AS ENUM ('ROOF', 'SIDING', 'WINDOW', 'DOOR')`);
        await queryRunner.query(`UPDATE brands SET category = 'ROOF' WHERE category = 'ROOFING'`);
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category TYPE brand_category_enum USING category::brand_category_enum`);
        await queryRunner.query(`ALTER TABLE brands ALTER COLUMN category SET DEFAULT 'ROOF'`);
        
        console.log('✅ Successfully rolled back ROOFING to ROOF');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback category update:', error.message);
        throw error;
    }
}
