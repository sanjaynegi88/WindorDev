import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting cities and audit system migration...');
    
    try {
        // 1. Create cities table
        console.log('🏙️ Creating cities table...');
        await queryRunner.query(`
            CREATE TABLE "cities" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "name" VARCHAR(100) NOT NULL,
                "state" VARCHAR(50) NOT NULL,
                "zip_codes" JSONB NOT NULL DEFAULT '[]',
                "is_active" BOOLEAN DEFAULT true,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created cities table');
        
        // 2. Create audit_logs table
        console.log('📋 Creating audit_logs table...');
        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "table_name" VARCHAR(50) NOT NULL,
                "record_id" UUID NOT NULL,
                "action" VARCHAR(20) NOT NULL CHECK ("action" IN ('CREATE', 'UPDATE', 'DELETE')),
                "old_values" JSONB,
                "new_values" JSONB,
                "changed_by_user_id" UUID NOT NULL,
                "change_reason" TEXT,
                "ip_address" VARCHAR(45),
                "user_agent" TEXT,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created audit_logs table');
        
        // 3. Add city_id column to users table
        console.log('👥 Adding city_id to users table...');
        await queryRunner.query(`
            ALTER TABLE "users" ADD COLUMN "city_id" UUID
        `);
        console.log('✅ Added city_id to users table');
        
        // 4. Add city_id column to properties table
        console.log('🏠 Adding city_id to properties table...');
        await queryRunner.query(`
            ALTER TABLE "properties" ADD COLUMN "city_id" UUID
        `);
        console.log('✅ Added city_id to properties table');
        
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
    
    console.log('🎉 Cities and audit system migration completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back cities and audit system migration...');
    
    try {
        // Remove city_id columns
        console.log('🔄 Removing city_id from properties table...');
        await queryRunner.query(`
            ALTER TABLE "properties" DROP COLUMN IF EXISTS "city_id"
        `);
        
        console.log('🔄 Removing city_id from users table...');
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN IF EXISTS "city_id"
        `);
        
        // Drop tables
        console.log('🔄 Dropping audit_logs table...');
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE`);
        
        console.log('🔄 Dropping cities table...');
        await queryRunner.query(`DROP TABLE IF EXISTS "cities" CASCADE`);
        
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
    
    console.log('🎉 Cities and audit system rollback completed successfully!');
}