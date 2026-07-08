import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLog } from '../entities/audit-log.entity';
import { User } from '../entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([AuditLog, User])],
    controllers: [AuditController],
    providers: [AuditService],
    exports: [AuditService]
})
export class AuditModule {}