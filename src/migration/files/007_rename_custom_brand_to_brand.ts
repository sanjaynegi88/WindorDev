import { QueryRunner } from 'typeorm';

export async function up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Renaming custom_brand columns to brand...');
    
    try {
        // Rename custom_brand to brand in roofing table
        await queryRunner.query(`ALTER TABLE "roofing" RENAME COLUMN "custom_brand" TO "brand"`);
        console.log('✅ Renamed custom_brand to brand in roofing table');
        
        // Rename custom_brand to brand in siding table
        await queryRunner.query(`ALTER TABLE "siding" RENAME COLUMN "custom_brand" TO "brand"`);
        console.log('✅ Renamed custom_brand to brand in siding table');
        
        // Rename custom_brand to brand in windows_doors table
        await queryRunner.query(`ALTER TABLE "windows_doors" RENAME COLUMN "custom_brand" TO "brand"`);
        console.log('✅ Renamed custom_brand to brand in windows_doors table');
        
    } catch (error: any) {
        console.error('❌ Failed to rename custom_brand columns:', error.message);
        throw error;
    }
    
    console.log('🎉 Brand column rename migration completed successfully.');
}

export async function down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️ Rolling back brand column rename...');
    
    try {
        // Revert brand to custom_brand in windows_doors table
        await queryRunner.query(`ALTER TABLE "windows_doors" RENAME COLUMN "brand" TO "custom_brand"`);
        console.log('✅ Reverted brand to custom_brand in windows_doors table');
        
        // Revert brand to custom_brand in siding table
        await queryRunner.query(`ALTER TABLE "siding" RENAME COLUMN "brand" TO "custom_brand"`);
        console.log('✅ Reverted brand to custom_brand in siding table');
        
        // Revert brand to custom_brand in roofing table
        await queryRunner.query(`ALTER TABLE "roofing" RENAME COLUMN "brand" TO "custom_brand"`);
        console.log('✅ Reverted brand to custom_brand in roofing table');
        
    } catch (error: any) {
        console.error('❌ Failed to revert brand columns:', error.message);
        throw error;
    }
    
    console.log('🎉 Brand column rollback completed successfully.');
}