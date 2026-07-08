import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 007: Add half_hourly_amount to membership_plans...');
    
    // Check which columns already exist
    const existingColumns = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'membership_plans' 
        AND column_name IN ('half_hourly_amount', 'half_hourly_price_id')
    `);
    
    const existingColumnNames = existingColumns.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumnNames);
    
    // Add half_hourly_amount column if it doesn't exist
    if (!existingColumnNames.includes('half_hourly_amount')) {
        await queryRunner.query(`
            ALTER TABLE "membership_plans" 
            ADD COLUMN "half_hourly_amount" DECIMAL(10,2) DEFAULT 0.00
        `);
        console.log('✅ Added half_hourly_amount column');
    } else {
        console.log('⚠️ half_hourly_amount column already exists, skipping...');
    }
    
    // Add half_hourly_price_id column if it doesn't exist
    if (!existingColumnNames.includes('half_hourly_price_id')) {
        await queryRunner.query(`
            ALTER TABLE "membership_plans" 
            ADD COLUMN "half_hourly_price_id" VARCHAR(255) DEFAULT 'free'
        `);
        console.log('✅ Added half_hourly_price_id column');
    } else {
        console.log('⚠️ half_hourly_price_id column already exists, skipping...');
    }
    
    console.log('🎉 Migration 007 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 007...');
    
    // Drop added columns
    await queryRunner.query(`ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "half_hourly_amount";`);
    await queryRunner.query(`ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "half_hourly_price_id";`);
    
    console.log('✅ Migration 007 rolled back successfully');
}