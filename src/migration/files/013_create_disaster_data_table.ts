import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 013: Create disaster_data table...');
    
    try {
        // Create disaster_data table
        await queryRunner.query(`
            CREATE TABLE "disaster_data" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "disaster_name" VARCHAR(255) NOT NULL,
                "start_date" TIMESTAMP NOT NULL,
                "end_date" TIMESTAMP NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
                "created_by" UUID NOT NULL,
                "updated_by" UUID NULL
            )
        `);
        console.log('✅ Created disaster_data table');
        
        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "disaster_data" 
            ADD CONSTRAINT "FK_disaster_data_created_by" 
            FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE
        `);
        
        await queryRunner.query(`
            ALTER TABLE "disaster_data" 
            ADD CONSTRAINT "FK_disaster_data_updated_by" 
            FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL
        `);
        console.log('✅ Added foreign key constraints for user references');
        
        // Add indexes for better performance
        await queryRunner.query(`
            CREATE INDEX "IDX_disaster_data_disaster_name" ON "disaster_data" ("disaster_name")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_disaster_data_start_date" ON "disaster_data" ("start_date")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_disaster_data_end_date" ON "disaster_data" ("end_date")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_disaster_data_created_by" ON "disaster_data" ("created_by")
        `);
        console.log('✅ Added indexes for disaster_data table');
        
    } catch (error) {
        console.log('⚠️ Error in migration 013:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 013 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 013...');
    
    try {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disaster_data_created_by"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disaster_data_end_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disaster_data_start_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_disaster_data_disaster_name"`);
        
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "disaster_data" DROP CONSTRAINT IF EXISTS "FK_disaster_data_updated_by"`);
        await queryRunner.query(`ALTER TABLE "disaster_data" DROP CONSTRAINT IF EXISTS "FK_disaster_data_created_by"`);
        
        // Drop the table
        await queryRunner.query(`DROP TABLE IF EXISTS "disaster_data"`);
        
        console.log('✅ Dropped disaster_data table and all related constraints');
        
    } catch (error) {
        console.log('⚠️ Error rolling back migration 013:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 013 rolled back successfully');
}