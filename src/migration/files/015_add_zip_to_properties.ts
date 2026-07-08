import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Starting add zip column to properties migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "zip" VARCHAR(20)`);
        console.log('✅ Added zip column');
    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back add zip column migration...');
    try {
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN IF EXISTS "zip"`);
    } catch (error: any) {
        console.error('❌ Rollback failed:', error.message);
        throw error;
    }
}
