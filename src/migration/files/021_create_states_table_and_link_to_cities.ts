import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating states table and updating cities table...');
    
    try {
        // 1. Create states table
        await queryRunner.query(`
            CREATE TABLE "states" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "state_name" VARCHAR(100) NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created states table');

        // 2. Add state_id to cities table
        await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN "state_id" UUID`);
        console.log('✅ Added state_id column to cities table');

        // 3. Add foreign key constraint
        await queryRunner.query(`
            ALTER TABLE "cities" 
            ADD CONSTRAINT "FK_cities_state" 
            FOREIGN KEY ("state_id") 
            REFERENCES "states"("id") 
            ON DELETE SET NULL
        `);
        console.log('✅ Added foreign key constraint to cities table');
        
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back states table and cities update...');
    
    try {
        // 1. Remove foreign key
        await queryRunner.query(`ALTER TABLE "cities" DROP CONSTRAINT "FK_cities_state"`);
        console.log('✅ Removed foreign key constraint from cities table');

        // 2. Remove state_id column
        await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN "state_id"`);
        console.log('✅ Removed state_id column from cities table');

        // 3. Drop states table
        await queryRunner.query(`DROP TABLE IF EXISTS "states" CASCADE`);
        console.log('✅ Dropped states table');
        
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
}
