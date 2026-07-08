import { QueryRunner } from 'typeorm';

const migration = {
    async up(queryRunner: QueryRunner): Promise<void> {
        // ── roofing ──────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE public.roofing
            ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS root_id UUID DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true
        `);
        // Set root_id = id for all existing rows (each is its own root)
        await queryRunner.query(`
            UPDATE public.roofing SET root_id = id WHERE root_id IS NULL
        `);

        // ── siding ───────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE public.siding
            ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS root_id UUID DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true
        `);
        await queryRunner.query(`
            UPDATE public.siding SET root_id = id WHERE root_id IS NULL
        `);

        // ── windows_doors ────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE public.windows_doors
            ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS root_id UUID DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true
        `);
        await queryRunner.query(`
            UPDATE public.windows_doors SET root_id = id WHERE root_id IS NULL
        `);

        // ── indexes for fast latest-version lookups ───────────────────────────
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_roofing_is_latest
            ON public.roofing(property_id, is_latest)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_siding_is_latest
            ON public.siding(property_id, is_latest)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_windows_doors_is_latest
            ON public.windows_doors(property_id, is_latest)
        `);
    },
};

export default migration;
