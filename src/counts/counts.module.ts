import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountsController } from './counts.controller';
import { CountsService } from './counts.service';
import { User } from '../entities/user.entity';
import { Brand } from '../entities/brand.entity';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { Report } from '../entities/report.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Brand, City, State, Report])
    ],
    controllers: [CountsController],
    providers: [CountsService],
    exports: [CountsService]
})
export class CountsModule {}