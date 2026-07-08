import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceProvided } from '../entities/service-provided.entity';
import { ServicesProvidedService } from './services-provided.service';
import { ServicesProvidedController } from './services-provided.controller';

@Module({
    imports: [TypeOrmModule.forFeature([ServiceProvided])],
    controllers: [ServicesProvidedController],
    providers: [ServicesProvidedService],
    exports: [ServicesProvidedService],
})
export class ServicesProvidedModule {}
