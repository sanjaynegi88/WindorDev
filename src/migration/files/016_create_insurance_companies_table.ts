import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating insurance_companies table...');
    
    try {
        // Create insurance_companies table
        await queryRunner.query(`
            CREATE TABLE insurance_companies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log('✅ Successfully created insurance_companies table');
        
    } catch (error: any) {
        console.error('❌ Failed to create insurance_companies table:', error.message);
        throw error;
    }
    
    console.log('🎉 Insurance companies table migration completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back insurance_companies table creation...');
    
    try {
        // Drop insurance_companies table
        await queryRunner.query(`DROP TABLE IF EXISTS insurance_companies CASCADE;`);
        console.log('✅ Successfully dropped insurance_companies table');
        
    } catch (error: any) {
        console.error('❌ Failed to drop insurance_companies table:', error.message);
        throw error;
    }
    
    console.log('🎉 Insurance companies table rollback completed successfully.');
}
