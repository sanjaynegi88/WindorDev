import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { RolesService } from './roles.service';
import { RolesController, RolesPublicController } from './roles.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Role, User])],
    controllers: [RolesPublicController, RolesController],
    providers: [RolesService],
    exports: [RolesService],
})
export class RolesModule {}
