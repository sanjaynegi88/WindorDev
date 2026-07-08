import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating brands table...');
    
    try {
        // Create brands table
        await queryRunner.query(`
            CREATE TABLE brands (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                brand_name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Successfully created brands table');
        
    } catch (error: any) {
        console.error('❌ Failed to create brands table:', error.message);
        throw error;
    }
    
    console.log('🎉 Brands table migration completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back brands table creation...');
    
    try {
        // Drop brands table
        await queryRunner.query(`DROP TABLE IF EXISTS brands CASCADE;`);
        console.log('✅ Successfully dropped brands table');
        
    } catch (error: any) {
        console.error('❌ Failed to drop brands table:', error.message);
        throw error;
    }
    
    console.log('🎉 Brands table rollback completed successfully.');
}