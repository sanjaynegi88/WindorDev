import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Reorganizing user fields between users and user_profiles tables...');
    
    try {
        // Step 1: Add first_name and last_name to users table
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "first_name" VARCHAR(100)`);
        console.log('✅ Added first_name column to users table');
        
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "last_name" VARCHAR(100)`);
        console.log('✅ Added last_name column to users table');
        
        // Step 2: Add display_name to user_profiles table
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "display_name" VARCHAR(255)`);
        console.log('✅ Added display_name column to user_profiles table');
        
        // Step 3: Copy data from user_profiles to users (first_name, last_name)
        await queryRunner.query(`
            UPDATE "users" 
            SET "first_name" = "user_profiles"."first_name",
                "last_name" = "user_profiles"."last_name"
            FROM "user_profiles" 
            WHERE "users"."id" = "user_profiles"."user_id"
        `);
        console.log('✅ Copied first_name and last_name from user_profiles to users');
        
        // Step 4: Copy data from users to user_profiles (display_name)
        await queryRunner.query(`
            UPDATE "user_profiles" 
            SET "display_name" = "users"."display_name"
            FROM "users" 
            WHERE "user_profiles"."user_id" = "users"."id"
        `);
        console.log('✅ Copied display_name from users to user_profiles');
        
        // Step 5: Drop old columns
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "first_name"`);
        console.log('✅ Removed first_name column from user_profiles table');
        
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "last_name"`);
        console.log('✅ Removed last_name column from user_profiles table');
        
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "display_name"`);
        console.log('✅ Removed display_name column from users table');
        
    } catch (error: any) {
        console.error('❌ Failed to reorganize user fields:', error.message);
        throw error;
    }
    
    console.log('🎉 User fields reorganization completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back user fields reorganization...');
    
    try {
        // Step 1: Add back the original columns
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(255)`);
        console.log('✅ Added back display_name column to users table');
        
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "first_name" VARCHAR(100)`);
        console.log('✅ Added back first_name column to user_profiles table');
        
        await queryRunner.query(`ALTER TABLE "user_profiles" ADD COLUMN "last_name" VARCHAR(100)`);
        console.log('✅ Added back last_name column to user_profiles table');
        
        // Step 2: Copy data back to original locations
        await queryRunner.query(`
            UPDATE "user_profiles" 
            SET "first_name" = "users"."first_name",
                "last_name" = "users"."last_name"
            FROM "users" 
            WHERE "user_profiles"."user_id" = "users"."id"
        `);
        console.log('✅ Copied first_name and last_name back to user_profiles');
        
        await queryRunner.query(`
            UPDATE "users" 
            SET "display_name" = "user_profiles"."display_name"
            FROM "user_profiles" 
            WHERE "users"."id" = "user_profiles"."user_id"
        `);
        console.log('✅ Copied display_name back to users');
        
        // Step 3: Drop the new columns
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "first_name"`);
        console.log('✅ Removed first_name column from users table');
        
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_name"`);
        console.log('✅ Removed last_name column from users table');
        
        await queryRunner.query(`ALTER TABLE "user_profiles" DROP COLUMN "display_name"`);
        console.log('✅ Removed display_name column from user_profiles table');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback user fields reorganization:', error.message);
        throw error;
    }
    
    console.log('🎉 User fields rollback completed successfully.');
}