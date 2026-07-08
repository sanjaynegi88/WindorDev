import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting remove city column from properties migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "city"`);
        console.log('✅ Removed city column');
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back remove city column migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "city" VARCHAR(100)`);
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
}
