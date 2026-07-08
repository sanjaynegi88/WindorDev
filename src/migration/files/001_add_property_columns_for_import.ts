import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 001: Add property_name and state columns for CSV import...');
    
    // Check which columns already exist
    const existingColumns = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name IN ('property_name', 'state_id', 'city_name', 'state_name')
    `);
    
    const existingColumnNames = existingColumns.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumnNames);
    
    // Add property_name column if it doesn't exist
    if (!existingColumnNames.includes('property_name')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "property_name" VARCHAR(255);`);
        console.log('✅ Added property_name column');
    } else {
        console.log('⚠️ property_name column already exists, skipping...');
    }
    
    // Add state_id column if it doesn't exist
    if (!existingColumnNames.includes('state_id')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "state_id" UUID;`);
        console.log('✅ Added state_id column');
    } else {
        console.log('⚠️ state_id column already exists, skipping...');
    }
    
    // Add city_name column if it doesn't exist
    if (!existingColumnNames.includes('city_name')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "city_name" VARCHAR(255);`);
        console.log('✅ Added city_name column');
    } else {
        console.log('⚠️ city_name column already exists, skipping...');
    }
    
    // Add state_name column if it doesn't exist
    if (!existingColumnNames.includes('state_name')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "state_name" VARCHAR(255);`);
        console.log('✅ Added state_name column');
    } else {
        console.log('⚠️ state_name column already exists, skipping...');
    }
    
    try {
        // Check if property_owner_id column allows NULL
        const result = await queryRunner.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'properties' 
            AND column_name = 'property_owner_id'
        `);
        
        if (result[0]?.is_nullable === 'NO') {
            // Make property_owner_id nullable
            await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "property_owner_id" DROP NOT NULL;`);
            console.log('✅ Made property_owner_id nullable');
        } else {
            console.log('⚠️ property_owner_id already nullable, skipping...');
        }
    } catch (error) {
        console.log('⚠️ Could not modify property_owner_id nullable constraint:', error.message);
    }
    
    try {
        // Check if created_by column allows NULL
        const result = await queryRunner.query(`
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'properties' 
            AND column_name = 'created_by'
        `);
        
        if (result[0]?.is_nullable === 'NO') {
            // Make created_by nullable
            await queryRunner.query(`ALTER TABLE "properties" ALTER COLUMN "created_by" DROP NOT NULL;`);
            console.log('✅ Made created_by nullable');
        } else {
            console.log('⚠️ created_by already nullable, skipping...');
        }
    } catch (error) {
        console.log('⚠️ Could not modify created_by nullable constraint:', error.message);
    }
    
    try {
        // Check if foreign key constraint already exists
        const constraintExists = await queryRunner.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'properties' 
            AND constraint_name = 'FK_properties_state_id'
        `);
        
        if (constraintExists.length === 0) {
            // Add foreign key constraint for state_id
            await queryRunner.query(`
                ALTER TABLE "properties" 
                ADD CONSTRAINT "FK_properties_state_id" 
                FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL
            `);
            console.log('✅ Added foreign key constraint for state_id');
        } else {
            console.log('⚠️ Foreign key constraint already exists, skipping...');
        }
    } catch (error) {
        console.log('⚠️ Could not add foreign key constraint:', error.message);
    }
    
    console.log('🎉 Migration 001 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 001...');
    
    // Remove foreign key constraint
    await queryRunner.query(`ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "FK_properties_state_id";`);
    
    // Make columns NOT NULL again (only if they don't have NULL values)
    await queryRunner.query(`
        UPDATE "properties" SET "created_by" = 'system' WHERE "created_by" IS NULL;
        ALTER TABLE "properties" ALTER COLUMN "created_by" SET NOT NULL;
    `);
    
    await queryRunner.query(`
        DELETE FROM "properties" WHERE "property_owner_id" IS NULL;
        ALTER TABLE "properties" ALTER COLUMN "property_owner_id" SET NOT NULL;
    `);
    
    // Drop added columns
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "state_name";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "city_name";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "state_id";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "property_name";`);
    
    console.log('✅ Migration 001 rolled back successfully');
}