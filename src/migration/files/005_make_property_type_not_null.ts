import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 005: Make property_type NOT NULL without default...');
    
    try {
        // First, update any NULL property_type values to 'single-family'
        const nullCount = await queryRunner.query(`
            SELECT COUNT(*) as count FROM "properties" WHERE "property_type" IS NULL;
        `);
        
        if (nullCount[0]?.count > 0) {
            await queryRunner.query(`
                UPDATE "properties" SET "property_type" = 'single-family' WHERE "property_type" IS NULL;
            `);
            console.log(`✅ Updated ${nullCount[0].count} NULL property_type values to 'single-family'`);
        }
        
        // Remove the default value from property_type column
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "property_type" DROP DEFAULT;`);
        console.log('✅ Removed default value from property_type column');
        
        // Make property_type NOT NULL
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "property_type" SET NOT NULL;`);
        console.log('✅ Set property_type as NOT NULL');
        
    } catch (error: any) {
        console.log('⚠️ Could not modify property_type column:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 005 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 005...');
    
    try {
        // Make property_type nullable again
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "property_type" DROP NOT NULL;`);
        console.log('✅ Made property_type nullable again');
        
        // Add back the default value
        await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "property_type" SET DEFAULT 'single-family';`);
        console.log('✅ Restored default value for property_type column');
        
    } catch (error: any) {
        console.log('⚠️ Could not revert property_type column changes:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 005 rolled back successfully');
}