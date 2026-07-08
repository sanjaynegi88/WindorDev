import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorDirectoryProfile } from '../entities/contractor-directory-profile.entity';
import { User } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { City } from '../entities/city.entity';
import { ServiceProvided } from '../entities/service-provided.entity';
import { ContractorDirectoryService } from './contractor-directory.service';
import { ContractorDirectoryController, ContractorDirectoryPublicController, ContractorDirectoryAdminController } from './contractor-directory.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ContractorDirectoryProfile,
            User,
            Subscription,
            MembershipPlan,
            City,
            ServiceProvided,
        ])
    ],
    providers: [ContractorDirectoryService],
    controllers: [ContractorDirectoryController, ContractorDirectoryPublicController, ContractorDirectoryAdminController],
    exports: [ContractorDirectoryService]
})
export class ContractorDirectoryModule {}