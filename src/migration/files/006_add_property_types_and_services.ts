import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // Create property_types table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS public.property_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type_name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create services_provided table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS public.services_provided (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                service_name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
    },
};

export default migration;
