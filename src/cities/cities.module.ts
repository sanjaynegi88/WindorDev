import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';
import { City } from '../entities/city.entity';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { State } from '../entities/state.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([City, User, Property, State]),
        AuditModule
    ],
    controllers: [CitiesController],
    providers: [CitiesService],
    exports: [CitiesService]
})
export class CitiesModule {}