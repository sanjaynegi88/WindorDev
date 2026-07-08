import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Dropping deprecated state column from cities table...');
    
    try {
        await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN "state"`);
        console.log('✅ Dropped state column from cities table');
        
    } catch (error: any) {
        console.error('❌ Failed to drop state column:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back state column removal...');
    
    try {
        await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN "state" VARCHAR(50)`);
        console.log('✅ Re-added state column to cities table');
        
    } catch (error: any) {
        console.error('❌ Failed to re-add state column:', error.message);
        throw error;
    }
}
