import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Adding required property_owner_id to properties table...');
    
    try {
        // Since the user wants it as a required field, we add it as NOT NULL.
        // If there are existing properties, this might fail unless we provide a default 
        // or handle existing data. 
        await queryRunner.query(`ALTER TABLE "properties" ADD COLUMN "property_owner_id" UUID NOT NULL`);
        
        // Add foreign key constraint
        await queryRunner.query(`ALTER TABLE "properties" ADD CONSTRAINT "FK_properties_owner" FOREIGN KEY ("property_owner_id") REFERENCES "users"("id") ON DELETE CASCADE`);
        
        console.log('✅ Added property_owner_id and foreign key to properties');
        
    } catch (error: any) {
        console.error('❌ Failed to add property_owner_id:', error.message);
        throw error;
    }
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back property_owner_id addition...');
    
    try {
        await queryRunner.query(`ALTER TABLE "properties" DROP CONSTRAINT "FK_properties_owner"`);
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN "property_owner_id"`);
        console.log('✅ Removed property_owner_id from properties');
        
    } catch (error: any) {
        console.error('❌ Failed to rollback property_owner_id:', error.message);
        throw error;
    }
}
