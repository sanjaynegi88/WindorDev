import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting migration 016: Add latitude and longitude to cities table...');

    try {
        const latitudeExists = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'cities'
            AND column_name = 'latitude'
        `);

        if (!latitudeExists.length) {
            await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN "latitude" DECIMAL(10, 7) NULL`);
            console.log('✅ Added latitude column to cities');
        } else {
            console.log('⚠️ latitude column already exists in cities, skipping...');
        }

        const longitudeExists = await queryRunner.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'cities'
            AND column_name = 'longitude'
        `);

        if (!longitudeExists.length) {
            await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN "longitude" DECIMAL(10, 7) NULL`);
            console.log('✅ Added longitude column to cities');
        } else {
            console.log('⚠️ longitude column already exists in cities, skipping...');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log('⚠️ Error in migration 016:', message);
        throw error;
    }

    console.log('🎉 Migration 016 completed successfully!');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Rolling back migration 016...');

    try {
        await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN IF EXISTS "longitude"`);
        await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN IF EXISTS "latitude"`);
        console.log('✅ Removed latitude and longitude columns from cities');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log('⚠️ Error rolling back migration 016:', message);
        throw error;
    }

    console.log('✅ Migration 016 rolled back successfully');
}
