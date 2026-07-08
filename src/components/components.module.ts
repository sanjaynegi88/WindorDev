import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { Report } from '../entities/report.entity';
import { Brand } from '../entities/brand.entity';
import { Property } from '../entities/property.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { ReportImage } from '../entities/report-image.entity';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';
import { LocalImageUploadService } from '../common/services/local-image-upload.service';
import { ReportsModule } from '../reports/reports.module';
import { AwsModule } from '../aws/aws.module';
import { ComponentImageCategoriesModule } from '../component-image-categories/component-image-categories.module';
import { imageFileFilter } from '../common/utils/file-validation.util';

@Module({
    imports: [
        TypeOrmModule.forFeature([Roofing, Siding, Windows, Doors, GarageDoors, Report, Brand, Property, PropertyProject, OwnerProject, ReportImage]),
        MulterModule.register({
            fileFilter: imageFileFilter,
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
        ReportsModule,
        AwsModule,
        ComponentImageCategoriesModule,
    ],
    providers: [ComponentsService, LocalImageUploadService],
    controllers: [ComponentsController],
    exports: [ComponentsService],
})
export class ComponentsModule { }