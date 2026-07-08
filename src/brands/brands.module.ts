import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brand } from '../entities/brand.entity';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Brand]),
        AuditModule
    ],
    providers: [BrandsService],
    controllers: [BrandsController],
    exports: [BrandsService],
})
export class BrandsModule {}