import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 014: Add city_id to disaster_data table...');
    
    try {
        // Add city_id column to disaster_data table
        await queryRunner.query(`
            ALTER TABLE "disaster_data" 
            ADD COLUMN "city_id" UUID NOT NULL
        `);
        console.log('✅ Added city_id column to disaster_data table');
        
        // Add foreign key constraint referencing cities table
        await queryRunner.query(`
            ALTER TABLE "disaster_data" 
            ADD CONSTRAINT "FK_disaster_data_city_id" 
            FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE
        `);
        console.log('✅ Added foreign key constraint for city_id');
        
        // Add index for better performance
        await queryRunner.query(`
            CREATE INDEX "IDX_disaster_data_city_id" ON "disaster_data" ("city_id")
        `);
        console.log('✅ Added index for city_id');
        
    } catch (error) {
        console.log('⚠️ Error in migration 014:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 014 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 014...');
    
    try {
        // Drop index first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disaster_data_city_id"`);
        
        // Drop foreign key constraint
        await queryRunner.query(`ALTER TABLE "disaster_data" DROP CONSTRAINT IF EXISTS "FK_disaster_data_city_id"`);
        
        // Drop the column
        await queryRunner.query(`ALTER TABLE "disaster_data" DROP COLUMN IF EXISTS "city_id"`);
        
        console.log('✅ Removed city_id column from disaster_data table');
        
    } catch (error) {
        console.log('⚠️ Error rolling back migration 014:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 014 rolled back successfully');
}
