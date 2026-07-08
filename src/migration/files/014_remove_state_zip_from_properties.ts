import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting remove state and zip columns from properties migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "state"`);
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "zip"`);
        console.log('✅ Removed state and zip columns');
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back remove state and zip columns migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "state" VARCHAR(100)`);
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "zip" VARCHAR(20)`);
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
}
