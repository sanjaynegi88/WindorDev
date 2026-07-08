import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from './firebase/firebase.module';
import { MigrationModule } from './migration/migration.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';
import { PropertiesModule } from './properties/properties.module';
import { ComponentsModule } from './components/components.module';
import { MembershipPlansModule } from './membership-plans/membership-plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { BrandsModule } from './brands/brands.module';
import { StripeModule } from './stripe/stripe.module';
import { CitiesModule } from './cities/cities.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ContractorDirectoryModule } from './contractor-directory/contractor-directory.module';
import { ReportAccessModule } from './report-access/report-access.module';
import { AwsModule } from './aws/aws.module';
import { MembershipSchedulerService } from './common/services/membership-scheduler.service';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { Property } from './entities/property.entity';
import { Report } from './entities/report.entity';
import { Roofing } from './entities/roofing.entity';
import { Siding } from './entities/siding.entity';
import { Windows } from './entities/windows.entity';
import { Doors } from './entities/doors.entity';
import { GarageDoors } from './entities/garage-doors.entity';
import { WindowsDoors } from './entities/windows-doors.entity';
import { ReportImage } from './entities/report-image.entity';
import { MembershipPlan } from './entities/membership-plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Brand } from './entities/brand.entity';
import { City } from './entities/city.entity';
import { AuditLog } from './entities/audit-log.entity';
import { State } from './entities/state.entity';
import { Notification } from './entities/notification.entity';
import { ReportPurchase } from './entities/report-purchase.entity';
import { UserPurchase } from './entities/user-purchase.entity';
import { ContractorDirectoryProfile } from './entities/contractor-directory-profile.entity';
import { UserReportUsage } from './entities/user-report-usage.entity';
import { StatesModule } from './states/states.module';
import { AuditModule } from './audit/audit.module';
import { CountsModule } from './counts/counts.module';
import { NotificationsService } from './notifications/notifications.service';
import { PropertyTypesModule } from './property-types/property-types.module';
import { ServicesProvidedModule } from './services-provided/services-provided.module';
import { PropertyType } from './entities/property-type.entity';
import { ServiceProvided } from './entities/service-provided.entity';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { AppSetting } from './entities/app-setting.entity';
import { RolesModule } from './roles/roles.module';
import { Role } from './entities/role.entity';
import { ComponentImageCategoriesModule } from './component-image-categories/component-image-categories.module';
import { PropertyProject } from './entities/property-project.entity';
import { OwnerProject } from './entities/owner-project.entity';
import { ProjectPermit } from './entities/project-permit.entity';
import { PropertyProjectsModule } from './property-projects/property-projects.module';
import { UserForm } from './entities/form.entity';
import { FormsModule } from './forms/forms.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.POSTGRES_CONNECTION_STRING,
      entities: [
        User, UserProfile, Property, Report,
        Roofing, Siding, Windows, Doors, GarageDoors, WindowsDoors, ReportImage, MembershipPlan, Subscription, Brand,
        City, AuditLog, State, Notification, ReportPurchase, UserPurchase, ContractorDirectoryProfile,
        UserReportUsage, PropertyType, ServiceProvided, AppSetting, Role, 
        PropertyProject, OwnerProject, ProjectPermit, UserForm
      ],
      autoLoadEntities: true,
      logging: ['query', 'error'],
      synchronize: false, 
    }),
    TypeOrmModule.forFeature([
      Subscription, MembershipPlan, User, UserProfile, Notification
    ]),
    FirebaseModule,
    MigrationModule,
    AuthModule,
    UsersModule,
    ReportsModule,
    PropertiesModule,
    ComponentsModule,
    MembershipPlansModule,
    SubscriptionsModule,
    BrandsModule,
    StripeModule,
    CitiesModule,
    NotificationsModule,
    ContractorDirectoryModule,
    ReportAccessModule,
    AwsModule,
    StatesModule,
    AuditModule,
    CountsModule,
    PropertyTypesModule,
    ServicesProvidedModule,
    AppSettingsModule,
    RolesModule,
    ComponentImageCategoriesModule,
    PropertyProjectsModule,
    FormsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    MembershipSchedulerService,
    NotificationsService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
