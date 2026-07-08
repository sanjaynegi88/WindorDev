import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit DROP DEFAULT
    `);

    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit TYPE integer USING (
            CASE
                WHEN permit ~ '^[0-9]+$' THEN permit::integer
                ELSE NULL
            END
        )
    `);

    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit SET DEFAULT NULL
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit DROP DEFAULT
    `);

    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit TYPE character varying USING permit::varchar
    `);

    await queryRunner.query(`
        ALTER TABLE public.property_project
        ALTER COLUMN permit SET DEFAULT NULL
    `);
}
