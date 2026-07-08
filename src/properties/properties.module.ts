import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Property } from '../entities/property.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { ReportImage } from '../entities/report-image.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { Subscription } from '../entities/subscription.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { User } from '../entities/user.entity';
import { PropertyComment } from '../entities/property-comment.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { Notification } from '../entities/notification.entity';
import { PropertyType } from '../entities/property-type.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { ProjectPermit } from '../entities/project-permit.entity';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { PdfService } from './pdf.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsService } from '../notifications/notifications.service';
import { ReportAccessModule } from '../report-access/report-access.module';
import { AwsS3Service } from '../common/services/aws-s3.service';
import { imageFileFilter } from '../common/utils/file-validation.util';

@Module({
    imports: [
        TypeOrmModule.forFeature([Property, PropertyProject, Roofing, Siding, Windows, Doors, GarageDoors, ReportImage, ReportPurchase, Subscription, UserReportUsage, City, State, User, UserProfile, PropertyComment, Notification, PropertyType, OwnerProject, ProjectPermit]),
        MulterModule.register({
            fileFilter: imageFileFilter,
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
        AuditModule,
        forwardRef(() => ReportAccessModule),
    ],
    providers: [PropertiesService, PdfService, NotificationsService, AwsS3Service],
    controllers: [PropertiesController],
    exports: [PropertiesService, PdfService],
})
export class PropertiesModule { }