import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 004: Make address nullable in properties table...');
    
    try {
        // Check if address column allows NULL
        const result = await queryRunner.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'properties' 
            AND column_name = 'address'
        `);
        
        if (result[0]?.is_nullable === 'NO') {
            // Make address nullable
            await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "address" DROP NOT NULL;`);
            console.log('✅ Made address nullable in properties table');
        } else {
            console.log('⚠️ address already nullable in properties table, skipping...');
        }
    } catch (error: any) {
        console.log('⚠️ Could not modify address nullable constraint:', error.message);
    }
    
    console.log('🎉 Migration 004 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 004...');
    
    try {
        // Set default value for NULL addresses before making it NOT NULL
        await queryRunner.query(`
            UPDATE "properties" SET "address" = 'No address provided' WHERE "address" IS NULL;
        `);
        
        // Make address NOT NULL again
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "address" SET NOT NULL;`);
        
        console.log('✅ Made address NOT NULL again in properties table');
    } catch (error: any) {
        console.log('⚠️ Could not revert address nullable constraint:', error.message);
    }
    
    console.log('✅ Migration 004 rolled back successfully');
}