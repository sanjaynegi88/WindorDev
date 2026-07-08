import { Injectable, Inject } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FIREBASE_ADMIN_INJECT } from '../firebase/firebase.module';
import * as admin from 'firebase-admin';

@Injectable()
export class MigrationService {
    private readonly migrationsDir = path.join(__dirname, 'files');
    private readonly firestore: admin.firestore.Firestore;

    constructor(
        private readonly dataSource: DataSource,
        @Inject(FIREBASE_ADMIN_INJECT)
        private readonly firebaseAdmin: admin.app.App,
    ) {
        if (this.firebaseAdmin) {
            this.firestore = this.firebaseAdmin.firestore();
        }
    }

    async runMigrations() {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        console.log('🔍 DEBUG: Database connection established');

        try {
            /**
             * ✅ 1. READ MIGRATION FILES
             */
            if (!fs.existsSync(this.migrationsDir)) {
                console.log(`⚠️ Migrations directory not found: ${this.migrationsDir}`);
                return { message: 'Migrations directory not found' };
            }

            const files = fs
                .readdirSync(this.migrationsDir)
                .filter(
                    (file) =>
                        /^\d+_.*\.(js|ts)$/.test(file) &&
                        !file.endsWith('.d.ts') &&
                        !file.includes('.map'),
                )
                .sort();

            console.log(`🔍 DEBUG: Found ${files.length} migration files:`, files);
            console.log(`🔍 DEBUG: Migrations directory: ${this.migrationsDir}`);

            const results: string[] = [];
            const progressLogs: string[] = [];
            let appliedCount = 0;

            /**
             * ✅ 2. RUN MIGRATIONS SAFELY
             */
            for (const file of files) {
                const migrationName = file.replace(/\.(js|ts)$/, '');
                console.log(`🔍 Processing migration: ${migrationName}`);
                progressLogs.push(`🔍 Processing migration: ${migrationName}`);
                let isApplied = false;

                // Check if migration is applied
                try {
                    const check = await queryRunner.query(
                        `SELECT 1 FROM public.migrations WHERE name = $1 LIMIT 1`,
                        [migrationName],
                    );
                    if (check.length > 0) {
                        isApplied = true;
                    }
                    console.log(`✅ Check complete for ${migrationName} - Applied: ${isApplied}`);
                    progressLogs.push(`✅ Check complete for ${migrationName} - Applied: ${isApplied}`);
                } catch (err: any) {
                    // If table doesn't exist (code 42P01), we assume no migrations are applied.
                    // The 000 migration will create the table.
                    if (err.code !== '42P01') {
                        console.log(`❌ Error checking ${migrationName}:`, err.message);
                        throw err;
                    }
                    console.log(`⚠️ Migrations table not found for ${migrationName} - will create`);
                    // If 42P01, isApplied remains false.
                }

                if (isApplied) {
                    results.push(`⏭️ ${migrationName} already applied`);
                    console.log(`⏭️ OK - ${migrationName} already applied`);
                    progressLogs.push(`⏭️ OK - ${migrationName} already applied`);
                    continue;
                }

                console.log(`🚀 Running migration: ${migrationName}`);

                const migrationPath = path.join(this.migrationsDir, file);
                console.log(`📁 Loading migration file: ${migrationPath}`);

                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require(migrationPath);
                const migration = mod.default ?? mod;
                console.log(`📦 Migration module loaded for ${migrationName}`);

                if (typeof migration.up !== 'function') {
                    console.log(`❌ Migration ${file} missing up function`);
                    throw new Error(`❌ Migration "${file}" must export up(queryRunner, firestore)`);
                }
                console.log(`✅ Migration ${migrationName} has valid up function`);

                // Start transaction for the migration
                console.log(`🔄 Starting transaction for ${migrationName}`);
                await queryRunner.startTransaction();
                try {
                    console.log(`⚡ Executing migration ${migrationName}`);
                    // Pass both queryRunner and firestore to the migration
                    await migration.up(queryRunner, this.firestore);
                    console.log(`✅ Migration ${migrationName} executed successfully`);

                    // After 000 runs, the table exists (or was created), so we can insert.
                    console.log(`📝 Recording migration ${migrationName} in database`);
                    await queryRunner.query(
                        `INSERT INTO public.migrations (name) VALUES ($1)`,
                        [migrationName],
                    );
                    console.log(`✅ Migration ${migrationName} recorded in database`);

                    await queryRunner.commitTransaction();
                    console.log(`✅ Transaction committed for ${migrationName}`);

                    appliedCount++;
                    results.push(`✅ Applied: ${migrationName}`);
                    console.log(`🎉 OK - ${migrationName} completed successfully`);
                    progressLogs.push(`🎉 OK - ${migrationName} completed successfully`);
                } catch (err) {
                    console.log(`❌ Error in migration ${migrationName}:`, err.message);
                    await queryRunner.rollbackTransaction();
                    console.log(`🔄 Transaction rolled back for ${migrationName}`);
                    throw err;
                }
            }

            return {
                message: '🎉 Migrations completed successfully',
                applied: appliedCount,
                details: results,
                progress: progressLogs,
                totalFiles: files.length
            };
        } finally {
            console.log('🔍 DEBUG: Releasing database connection');
            await queryRunner.release();
        }
    }

    async resetMigrations() {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
            await queryRunner.query('DROP TABLE IF EXISTS public.migrations');
            return this.runMigrations();
        } finally {
            await queryRunner.release();
        }
    }
}