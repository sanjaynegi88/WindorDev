import { QueryRunner } from "typeorm";

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding insurance_company_id to users table...');
    try {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "insurance_company_id" uuid
        `);

        // Add foreign key constraint for insurance_company_id
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_insurance_company_id" 
            FOREIGN KEY ("insurance_company_id") 
            REFERENCES "insurance_companies"("id") 
            ON DELETE SET NULL
        `);

        console.log('✅ Insurance company column and constraint added successfully');
    } catch (error: any) {
        console.error('❌ Failed to update users table:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Removing insurance_company_id from users table...');
    try {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_insurance_company_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "insurance_company_id"`);
        console.log('✅ Insurance company column rolled back successfully');
    } catch (error: any) {
        console.error('❌ Failed to rollback users table update:', error.message);
        throw error;
    }
}
