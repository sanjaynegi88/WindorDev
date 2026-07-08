import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { PropertyProject } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { Property } from '../entities/property.entity';
import { User } from '../entities/user.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { WindowsDoors } from '../entities/windows-doors.entity';
import { Brand } from '../entities/brand.entity';
import { ReportImage } from '../entities/report-image.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { AwsModule } from '../aws/aws.module';
import { PropertyProjectsService } from './property-projects.service';
import { PropertyProjectsController } from './property-projects.controller';
import { OwnerProjectsController } from './owner-projects.controller';
import { PermitController } from './permit.controller';
import { ProjectController } from './project.controller';
import { OwnerProjectsService } from './owner-projects.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            PropertyProject,
            OwnerProject,
            Property,
            User,
            Roofing,
            Siding,
            WindowsDoors,
            Brand,
            ReportImage,
            Subscription,
            MembershipPlan,
        ]),
        MulterModule.register({
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
        AwsModule,
    ],
    controllers: [PropertyProjectsController, OwnerProjectsController, PermitController, ProjectController],
    providers: [PropertyProjectsService, OwnerProjectsService],
    exports: [PropertyProjectsService, OwnerProjectsService],
})
export class PropertyProjectsModule {}