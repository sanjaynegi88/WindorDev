import { QueryRunner } from "typeorm";

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding sub_account and parent_id to users table...');
    try {
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "sub_account" boolean NOT NULL DEFAULT false,
            ADD COLUMN "parent_id" uuid
        `);

        // Add foreign key constraint for parent_id
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_users_parent_id" 
            FOREIGN KEY ("parent_id") 
            REFERENCES "users"("id") 
            ON DELETE SET NULL
        `);

        console.log('✅ Sub-account columns and constraints added successfully');
    } catch (error: any) {
        console.error('❌ Failed to update users table:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Removing sub_account and parent_id from users table...');
    try {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_parent_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "parent_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sub_account"`);
        console.log('✅ Sub-account columns rolled back successfully');
    } catch (error: any) {
        console.error('❌ Failed to rollback users table update:', error.message);
        throw error;
    }
}
