import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatesController } from './states.controller';
import { StatesService } from './states.service';
import { State } from '../entities/state.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([State]),
        AuditModule
    ],
    controllers: [StatesController],
    providers: [StatesService],
    exports: [StatesService]
})
export class StatesModule {}
