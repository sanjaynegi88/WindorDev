import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { UserProfile } from '../entities/user-profile.entity';
import { User } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { UserForm } from '../entities/form.entity';
import { FormsModule } from '../forms/forms.module';
import { ServiceProvided } from '../entities/service-provided.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuditModule } from '../audit/audit.module';
import { imageFileFilter } from '../common/utils/file-validation.util';
import { MembershipPlansModule } from '../membership-plans/membership-plans.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserProfile, User, Subscription, UserForm, ServiceProvided]),
        FormsModule,
        MulterModule.register({
            fileFilter: imageFileFilter,
            // No file size limit for user profiles
        }),
        FirebaseModule,
        AuditModule,
        MembershipPlansModule,
    ],
    providers: [UsersService],
    controllers: [UsersController],
    exports: [UsersService],
})
export class UsersModule { }