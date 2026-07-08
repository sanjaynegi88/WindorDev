import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding CONTRACTOR role to users table (Safe Strategy)...');
    
    try {
        // 1. Change the column to VARCHAR temporarily to avoid enum constraints
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(255)`);
        
        // 2. Drop the old enum type if it exists separately
        // Note: The type name might be "users_role_enum"
        await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);

        // 3. Create the new enum type with all values including CONTRACTOR
        await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('CONTRACTOR', 'PROPERTY_OWNER', 'CITY_INSPECTOR', 'INSURANCE_COMPANY', 'ADMIN')`);

        // 4. Convert the column back to the new enum
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "users_role_enum" USING "role"::"users_role_enum"`);
        
        // 5. Set default
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PROPERTY_OWNER'`);
        
        console.log('✅ Successfully added CONTRACTOR role to users table');
        
    } catch (error: any) {
        console.error('❌ Failed to add CONTRACTOR role:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back CONTRACTOR role addition...');
    
    try {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(255)`);
        await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
        await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('PROPERTY_OWNER', 'CITY_INSPECTOR', 'INSURANCE_COMPANY', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "users_role_enum" USING "role"::"users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PROPERTY_OWNER'`);
        
        console.log('✅ Successfully removed CONTRACTOR role');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback CONTRACTOR role addition:', error.message);
        throw error;
    }
}
