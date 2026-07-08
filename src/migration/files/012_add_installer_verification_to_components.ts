import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 012: Add installer verification fields to component tables...');
    
    try {
        // Add installer verification fields to roofing table
        await queryRunner.query(`
            ALTER TABLE "roofing" 
            ADD COLUMN "installer_verified" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN "verified_by_inspector_id" UUID NULL,
            ADD COLUMN "verified_at" TIMESTAMP NULL
        `);
        console.log('✅ Added installer verification fields to roofing table');
        
        // Add installer verification fields to siding table
        await queryRunner.query(`
            ALTER TABLE "siding" 
            ADD COLUMN "installer_verified" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN "verified_by_inspector_id" UUID NULL,
            ADD COLUMN "verified_at" TIMESTAMP NULL
        `);
        console.log('✅ Added installer verification fields to siding table');
        
        // Add installer verification fields to windows_doors table
        await queryRunner.query(`
            ALTER TABLE "windows_doors" 
            ADD COLUMN "installer_verified" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN "verified_by_inspector_id" UUID NULL,
            ADD COLUMN "verified_at" TIMESTAMP NULL
        `);
        console.log('✅ Added installer verification fields to windows_doors table');
        
        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "roofing" 
            ADD CONSTRAINT "FK_roofing_verified_by_inspector" 
            FOREIGN KEY ("verified_by_inspector_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE "siding" 
            ADD CONSTRAINT "FK_siding_verified_by_inspector" 
            FOREIGN KEY ("verified_by_inspector_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);
        
        await queryRunner.query(`
            ALTER TABLE "windows_doors" 
            ADD CONSTRAINT "FK_windows_doors_verified_by_inspector" 
            FOREIGN KEY ("verified_by_inspector_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);
        console.log('✅ Added foreign key constraints for inspector references');
        
    } catch (error) {
        console.log('⚠️ Error in migration 012:', error.message);
        throw error;
    }
    
    console.log('🎉 Migration 012 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 012...');
    
    try {
        // Drop foreign key constraints first
        await queryRunner.query(`ALTER TABLE "roofing" DROP CONSTRAINT IF EXISTS "FK_roofing_verified_by_inspector"`);
        await queryRunner.query(`ALTER TABLE "siding" DROP CONSTRAINT IF EXISTS "FK_siding_verified_by_inspector"`);
        await queryRunner.query(`ALTER TABLE "windows_doors" DROP CONSTRAINT IF EXISTS "FK_windows_doors_verified_by_inspector"`);
        
        // Remove installer verification fields from roofing table
        await queryRunner.query(`
            ALTER TABLE "roofing" 
            DROP COLUMN IF EXISTS "installer_verified",
            DROP COLUMN IF EXISTS "verified_by_inspector_id",
            DROP COLUMN IF EXISTS "verified_at"
        `);
        
        // Remove installer verification fields from siding table
        await queryRunner.query(`
            ALTER TABLE "siding" 
            DROP COLUMN IF EXISTS "installer_verified",
            DROP COLUMN IF EXISTS "verified_by_inspector_id",
            DROP COLUMN IF EXISTS "verified_at"
        `);
        
        // Remove installer verification fields from windows_doors table
        await queryRunner.query(`
            ALTER TABLE "windows_doors" 
            DROP COLUMN IF EXISTS "installer_verified",
            DROP COLUMN IF EXISTS "verified_by_inspector_id",
            DROP COLUMN IF EXISTS "verified_at"
        `);
        
        console.log('✅ Removed installer verification fields from all component tables');
        
    } catch (error) {
        console.log('⚠️ Error rolling back migration 012:', error.message);
        throw error;
    }
    
    console.log('✅ Migration 012 rolled back successfully');
}