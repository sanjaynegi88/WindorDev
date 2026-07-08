import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 003: Add parcel_id, property_type, yearbuilt, square_foot to properties...');
    
    // Check which columns already exist
    const existingColumns = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name IN ('parcel_id', 'property_type', 'yearbuilt', 'square_foot')
    `);
    
    const existingColumnNames = existingColumns.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumnNames);
    
    // Add parcel_id column (auto-generated)
    if (!existingColumnNames.includes('parcel_id')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "parcel_id" VARCHAR(50) UNIQUE;`);
        console.log('✅ Added parcel_id column');
    } else {
        console.log('⚠️ parcel_id column already exists, skipping...');
    }
    
    // Add property_type column (single-family or duplex) - NOT NULL
    if (!existingColumnNames.includes('property_type')) {
        await queryRunner.query(`
            ALTER TABLE "properties" ADD COLUMN "property_type" VARCHAR(20) NOT NULL
            CHECK ("property_type" IN ('single-family', 'duplex'));
        `);
        console.log('✅ Added property_type column (NOT NULL) with constraint');
    } else {
        console.log('⚠️ property_type column already exists, skipping...');
    }
    
    // Add yearbuilt column
    if (!existingColumnNames.includes('yearbuilt')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "yearbuilt" INTEGER;`);
        console.log('✅ Added yearbuilt column');
    } else {
        console.log('⚠️ yearbuilt column already exists, skipping...');
    }
    
    // Add square_foot column
    if (!existingColumnNames.includes('square_foot')) {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "square_foot" INTEGER;`);
        console.log('✅ Added square_foot column');
    } else {
        console.log('⚠️ square_foot column already exists, skipping...');
    }
    
    // Create function to auto-generate parcel_id
    await queryRunner.query(`
        CREATE OR REPLACE FUNCTION generate_parcel_id() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.parcel_id IS NULL THEN
                NEW.parcel_id := 'PRC-' || EXTRACT(YEAR FROM NOW()) || '-' || 
                                LPAD(nextval('parcel_id_seq')::text, 6, '0');
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);
    
    // Create sequence for parcel_id
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS parcel_id_seq START 1;`);
    
    // Create trigger for auto-generating parcel_id
    await queryRunner.query(`
        DROP TRIGGER IF EXISTS trigger_generate_parcel_id ON properties;
        CREATE TRIGGER trigger_generate_parcel_id
            BEFORE INSERT ON properties
            FOR EACH ROW
            EXECUTE FUNCTION generate_parcel_id();
    `);
    
    console.log('✅ Created parcel_id auto-generation function and trigger');
    console.log('🎉 Migration 003 completed successfully!');
    console.log('📋 Summary of changes:');
    console.log('   - Added parcel_id (VARCHAR 50, UNIQUE, auto-generated)');
    console.log('   - Added property_type (VARCHAR 20, single-family or duplex)');
    console.log('   - Added yearbuilt (INTEGER)');
    console.log('   - Added square_foot (INTEGER)');
    console.log('   - Created auto-generation for parcel_id: PRC-YYYY-XXXXXX');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 003...');
    
    // Drop trigger and function
    await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_generate_parcel_id ON properties;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_parcel_id();`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS parcel_id_seq;`);
    
    // Drop added columns
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "square_foot";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "yearbuilt";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "property_type";`);
    await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "parcel_id";`);
    
    console.log('✅ Migration 003 rolled back successfully');
}