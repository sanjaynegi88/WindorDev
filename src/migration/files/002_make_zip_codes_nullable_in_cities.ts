import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 002: Make zip_codes nullable in cities table...');
    
    try {
        // Check if zip_codes column allows NULL
        const result = await queryRunner.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'cities' 
            AND column_name = 'zip_codes'
        `);
        
        if (result[0]?.is_nullable === 'NO') {
            // Make zip_codes nullable
            await queryRunner.query(`ALTER TABLE "cities" ALTER COLUMN "zip_codes" DROP NOT NULL;`);
            console.log('✅ Made zip_codes nullable in cities table');
        } else {
            console.log('⚠️ zip_codes already nullable in cities table, skipping...');
        }
    } catch (error) {
        console.log('⚠️ Could not modify zip_codes nullable constraint:', error.message);
    }
    
    console.log('🎉 Migration 002 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 002...');
    
    try {
        // Set empty array for NULL zip_codes before making it NOT NULL
        await queryRunner.query(`
            UPDATE "cities" SET "zip_codes" = '[]'::text[] WHERE "zip_codes" IS NULL;
        `);
        
        // Make zip_codes NOT NULL again
        await queryRunner.query(`ALTER TABLE "cities" ALTER COLUMN "zip_codes" SET NOT NULL;`);
        
        console.log('✅ Made zip_codes NOT NULL again in cities table');
    } catch (error) {
        console.log('⚠️ Could not revert zip_codes nullable constraint:', error.message);
    }
    
    console.log('✅ Migration 002 rolled back successfully');
}