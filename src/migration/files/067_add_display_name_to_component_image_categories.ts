import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the new column
    await queryRunner.query(`
        ALTER TABLE public.component_image_categories
        ADD COLUMN display_name character varying(100) DEFAULT NULL
    `);

    // 2. Copy the existing readable names to the new display_name field
    await queryRunner.query(`
        UPDATE public.component_image_categories
        SET display_name = category_name
    `);

    // 3. Format the existing category_name to be lowercase snake_case
    await queryRunner.query(`
        UPDATE public.component_image_categories
        SET category_name = LOWER(REGEXP_REPLACE(category_name, '[^a-zA-Z0-9]+', '_', 'g'))
    `);
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    // 1. Restore the original category_name from display_name
    await queryRunner.query(`
        UPDATE public.component_image_categories
        SET category_name = display_name
        WHERE display_name IS NOT NULL
    `);

    // 2. Drop the display_name column
    await queryRunner.query(`
        ALTER TABLE public.component_image_categories
        DROP COLUMN display_name
    `);
}
