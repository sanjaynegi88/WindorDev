import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Report } from '../entities/report.entity';
import { ReportImage } from '../entities/report-image.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { Property } from '../entities/property.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { imageFileFilter } from '../common/utils/file-validation.util';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Report,
            ReportImage,
            Roofing,
            Siding,
            Windows,
            Doors,
            GarageDoors,
            Property,
            PropertyProject,
            OwnerProject,
            User,
            Notification
        ]),
        MulterModule.register({
            fileFilter: imageFileFilter,
            limits: { fileSize: 2 * 1024 * 1024 },
        })
    ],
    providers: [ReportsService, NotificationsService],
    controllers: [ReportsController],
    exports: [ReportsService],
})
export class ReportsModule { }