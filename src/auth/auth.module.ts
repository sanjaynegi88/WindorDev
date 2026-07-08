import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { City } from '../entities/city.entity';
import { Subscription } from '../entities/subscription.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { TempUser } from '../entities/temp-user.entity';
import { State } from '../entities/state.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordReset } from '../entities/password-reset.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Role } from '../entities/role.entity';
import { UserForm } from '../entities/form.entity';
import { MailService } from '../mail/mail.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuditModule } from '../audit/audit.module';
import { HttpModule } from '@nestjs/axios';
import { UsersModule } from '../users/users.module';
import { FormsModule } from '../forms/forms.module';
import { MembershipPlansModule } from '../membership-plans/membership-plans.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { FirebaseJwtStrategy } from './strategies/firebase-jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { AdminAccessGuard } from './guards/admin.guard';
import { CleanupService } from './cleanup.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserProfile, City, State, Subscription, PasswordReset, RefreshToken, Role, UserForm, EmailVerification, TempUser]),
        FirebaseModule,
        HttpModule,
        UsersModule,
        FormsModule,
        AuditModule,
        MembershipPlansModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
    ],
    providers: [AuthService, MailService, FirebaseJwtStrategy, JwtStrategy, RolesGuard, AdminAccessGuard, CleanupService],
    controllers: [AuthController],
    exports: [AuthService, PassportModule, FirebaseJwtStrategy, JwtStrategy, RolesGuard, AdminAccessGuard],
})
export class AuthModule { }
