import { QueryRunner } from "typeorm";

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating authentication tables (password_resets, refresh_tokens)...');
    try {
        await queryRunner.query(`
            CREATE TABLE "password_resets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying NOT NULL,
                "otp" character varying(4) NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "is_used" boolean NOT NULL DEFAULT false,
                "is_verified" boolean NOT NULL DEFAULT false,
                "reset_token" uuid,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_password_resets" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "token" text NOT NULL,
                "user_id" uuid NOT NULL,
                "expires_at" TIMESTAMP,
                "is_revoked" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")
        `);
        console.log('✅ Authentication tables and indexes created successfully');
    } catch (error: any) {
        console.error('❌ Failed to create authentication tables:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Dropping authentication tables...');
    try {
        await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_user_id"`);
        await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_token"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "password_resets"`);
        console.log('✅ Authentication tables rolled back successfully');
    } catch (error: any) {
        console.error('❌ Failed to rollback authentication tables:', error.message);
        throw error;
    }
}
