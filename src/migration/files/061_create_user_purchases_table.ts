import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS public.user_purchases (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            purchased_by_user_id uuid NOT NULL,
            number_of_users integer NOT NULL,
            price_per_user numeric(10,2) NOT NULL,
            total_amount numeric(10,2) NOT NULL,
            payment_intent_id character varying,
            status character varying(50) NOT NULL DEFAULT 'pending',
            stripe_checkout_session_id character varying,
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            completed_at TIMESTAMP,
            metadata jsonb DEFAULT '{}',
            CONSTRAINT "PK_user_purchases" PRIMARY KEY (id),
            CONSTRAINT "FK_user_purchases_purchased_by_user_id" FOREIGN KEY (purchased_by_user_id) 
                REFERENCES public.users (id) ON DELETE CASCADE
        )
    `);

    // Create index on purchased_by_user_id and status for faster queries
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_user_purchases_purchased_by_user_id_status" 
        ON public.user_purchases (purchased_by_user_id, status)
    `);

    // Create index on stripe_checkout_session_id for webhook handling
    await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_user_purchases_stripe_checkout_session_id" 
        ON public.user_purchases (stripe_checkout_session_id)
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        DROP INDEX IF EXISTS public."IDX_user_purchases_stripe_checkout_session_id"
    `);

    await queryRunner.query(`
        DROP INDEX IF EXISTS public."IDX_user_purchases_purchased_by_user_id_status"
    `);

    await queryRunner.query(`
        DROP TABLE IF EXISTS public.user_purchases
    `);
}
