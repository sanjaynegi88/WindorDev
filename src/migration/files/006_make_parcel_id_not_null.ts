import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 006: Make parcel_id NOT NULL...');
    
    try {
        // First, check for NULL parcel_id values
        const nullCount = await queryRunner.query(`
            SELECT COUNT(*) as count FROM "properties" WHERE "parcel_id" IS NULL;
        `);
        
        if (nullCount[0]?.count > 0) {
            // Generate unique parcel_id for NULL values using UUID
            await queryRunner.query(`
                UPDATE "properties" 
                SET "parcel_id" = 'PARCEL-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12)
                WHERE "parcel_id" IS NULL;
            `);
            console.log(`✅ Updated ${nullCount[0].count} NULL parcel_id values with generated IDs`);
        }
        
        // Make parcel_id NOT NULL
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "parcel_id" SET NOT NULL;`);
        console.log('✅ Set parcel_id as NOT NULL');
        
    } catch (error: any) {
        console.log('⚠️ Could not modify parcel_id column:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 006 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 006...');
    
    try {
        // Make parcel_id nullable again
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "parcel_id" DROP NOT NULL;`);
        console.log('✅ Made parcel_id nullable again');
        
    } catch (error: any) {
        console.log('⚠️ Could not revert parcel_id column changes:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 006 rolled back successfully');
}