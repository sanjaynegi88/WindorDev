import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Service } from '../common/services/aws-s3.service';
import { AwsReportsService } from '../reports/aws-reports.service';
import { AwsComponentsService } from '../components/aws-components.service';
import { AwsComponentsController } from '../components/aws-components.controller';
import { LocalImageUploadService } from '../common/services/local-image-upload.service';
import { ReportImage } from '../entities/report-image.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { ReportsService } from '../reports/reports.service';
import { Report } from '../entities/report.entity';
import { Property } from '../entities/property.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { ComponentImageCategoriesModule } from '../component-image-categories/component-image-categories.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ReportImage,
            Roofing,
            Siding,
            Windows,
            Doors,
            GarageDoors,
            Report,
            Property,
            PropertyProject,
            OwnerProject,
            Notification,
            User
        ]),
        ComponentImageCategoriesModule,
    ],
    controllers: [AwsComponentsController],
    providers: [
        AwsS3Service,
        AwsReportsService,
        AwsComponentsService,
        LocalImageUploadService,
        ReportsService,
        NotificationsService
    ],
    exports: [
        AwsS3Service,
        AwsReportsService,
        AwsComponentsService,
        LocalImageUploadService,
    ]
})
export class AwsModule { }