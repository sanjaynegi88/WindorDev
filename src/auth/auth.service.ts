import { Injectable, Inject, Logger, BadRequestException, UnauthorizedException, ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { FIREBASE_ADMIN_INJECT } from '../firebase/firebase.module';
import { User, UserRole } from '../entities/user.entity';
import { UserProfile } from '../entities/user-profile.entity';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { Subscription } from '../entities/subscription.entity';
import { Role } from '../entities/role.entity';
import { TempUser } from '../entities/temp-user.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { UserForm } from '../entities/form.entity';
import { FormsService } from '../forms/forms.service';
import { RegisterDto, AdminCreateUserDto, AssignRoleDto } from './dto/auth.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PasswordReset } from '../entities/password-reset.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @Inject(FIREBASE_ADMIN_INJECT)
        private firebaseAdmin: admin.app.App,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserProfile)
        private profileRepository: Repository<UserProfile>,
        @InjectRepository(City)
        private cityRepository: Repository<City>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(Role)
        private roleRepository: Repository<Role>,
        @InjectRepository(PasswordReset)
        private passwordResetRepository: Repository<PasswordReset>,
        @InjectRepository(RefreshToken)
        private refreshTokenRepository: Repository<RefreshToken>,
        @InjectRepository(UserForm)
        private formRepository: Repository<UserForm>,
        @InjectRepository(TempUser)
        private tempUserRepository: Repository<TempUser>,
        @InjectRepository(State)
        private stateRepository: Repository<State>,
        @InjectRepository(EmailVerification)
        private emailVerificationRepository: Repository<EmailVerification>,
        private readonly formsService: FormsService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly mailService: MailService,
    ) { }

    async getRoleById(roleId: string): Promise<Role | null> {
        return await this.roleRepository.findOne({ where: { id: roleId } });
    }

    async registerUser(registerDto: RegisterDto | AdminCreateUserDto, sub_account: boolean = false, parent_id?: string, isAdminCall: boolean = false) {
        const {
            email,
            password,
            first_name,
            last_name,
            role_id: roleIdentifier,
        } = registerDto as any;

        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new BadRequestException('Email already registered');
        }

        // Check if this is an ADMIN role registration
        let roleEntity: Role | null = null;
        if (roleIdentifier) {
            roleEntity = await this.roleRepository.findOne({ where: { id: roleIdentifier } });
            if (!roleEntity) {
                roleEntity = await this.roleRepository.findOne({ where: { role_name: roleIdentifier } });
            }
        }

        // If admin role or sub_account, create user directly without OTP flow
        if (roleEntity?.role_name === UserRole.ADMIN || sub_account || isAdminCall) {
            const firebaseUid = await this.createFirebaseUser(email, password, false);
            const savedUser = await this.userRepository.manager.transaction(async (manager) => {
                const newUser = manager.create(User, {
                    firebase_uid: firebaseUid,
                    email,
                    first_name,
                    last_name,
                    role_id: roleEntity?.id,
                    state_id: (registerDto as any).state_id,
                    city_id: (registerDto as any).city_id,
                    zip: (registerDto as any).zip,
                    sub_account: sub_account,
                    parent_id: parent_id,
                } as any);
                const user = await manager.save(newUser);
                await manager.save(manager.create(UserProfile, {
                    user_id: user.id,
                    display_name: `${first_name} ${last_name}`,
                    company_name: (registerDto as any).company_name,
                }));
                return user;
            });

            // For admin calls with form data, save the form immediately
            if (isAdminCall && roleEntity?.role_name !== UserRole.ADMIN) {
                try {
                    const formDto = {
                        companyAddress: (registerDto as any).companyAddress,
                        websiteUrl: (registerDto as any).websiteUrl,
                        licenseNumber: (registerDto as any).licenseNumber,
                        mobilePhone: (registerDto as any).mobilePhone,
                        companyPhone: (registerDto as any).companyPhone,
                        propertyAddress: (registerDto as any).propertyAddress,
                        ownerDateStart: (registerDto as any).ownerDateStart,
                        ownerDateEnd: (registerDto as any).ownerDateEnd,
                        serviceTypes: (registerDto as any).serviceTypes,
                        title: (registerDto as any).title,
                        cityOfficial: (registerDto as any).cityOfficial,
                        cityAddress: (registerDto as any).cityAddress,
                        cityPhone: (registerDto as any).cityPhone,
                    };
                    
                    await this.formsService.saveForm(savedUser.id, formDto, {
                        company_name: (registerDto as any).company_name ?? null,
                        city_id: (registerDto as any).city_id ?? null,
                        isSubAccount: sub_account,
                    });
                } catch (formErr: any) {
                    // If form saving fails, rollback user creation
                    await this.userRepository.delete(savedUser.id);
                    await this.firebaseAdmin.auth().deleteUser(firebaseUid);
                    throw new BadRequestException(`Form validation failed: ${formErr.message}`);
                }
            }

            return {
                message: sub_account ? 'Staff member registered successfully' : isAdminCall ? 'User created successfully and ready to login' : 'Admin registration completed successfully',
                uid: firebaseUid,
                userId: savedUser.id,
                email,
            };
        }

        // For regular users, use the simplified registration flow with OTP
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes for OTP
        const passwordHash = this.hashPassword(password);
        
        let temp = await this.tempUserRepository.findOne({ where: { email } });
        if (temp && !temp.verified && temp.expires_at && temp.expires_at > new Date()) {
            throw new BadRequestException('An OTP was already sent to this email – please try again after 3 minutes');
        }

        const tempData: DeepPartial<TempUser> = {
            email,
            password_hash: passwordHash,
            first_name,
            last_name,
            role_id: roleIdentifier,
            expires_at: expiresAt,
            verified: false,
        };

        if (!temp) {
            const newTemp = this.tempUserRepository.create(tempData);
            await this.tempUserRepository.save(newTemp);
            temp = newTemp;
        } else {
            await this.tempUserRepository.update({ email }, tempData);
        }

        const firebaseUid = await this.createOrUpdateTempFirebaseUser(temp, email, password);
        if (!temp.firebase_uid || temp.firebase_uid !== firebaseUid) {
            await this.tempUserRepository.update({ email }, { firebase_uid: firebaseUid } as any);
        }

        const generatedOtp = (Math.floor(100000 + Math.random() * 900000)).toString();
        const otpHash = this.hashOtp(generatedOtp);
        await this.emailVerificationRepository.save({
            email,
            otp_hash: otpHash,
            expires_at: expiresAt,
            verified: false,
            attempts: 0,
            resend_count: 0,
        } as any);

        await this.mailService.sendRegistrationVerificationOtp(email, generatedOtp);
        return { message: 'OTP sent – please verify to complete registration' };
    }

    async verifyRegistrationOtp(email: string, otp: string) {
        const verification = await this.emailVerificationRepository.findOne({ where: { email } });
        if (!verification) {
            throw new BadRequestException('No OTP request found for this e-mail');
        }
        if (verification.expires_at < new Date()) {
            throw new BadRequestException('OTP has expired');
        }

        const otpMatches = this.hashOtp(otp) === verification.otp_hash;
        if (!otpMatches) {
            await this.emailVerificationRepository.update(verification.id, { attempts: (verification.attempts || 0) + 1 } as any);
            throw new BadRequestException('Invalid OTP');
        }

        const temp = await this.tempUserRepository.findOne({ where: { email } });
        if (!temp) {
            throw new BadRequestException('Temporary registration record missing – restart the flow');
        }
        if (!temp.firebase_uid) {
            throw new BadRequestException('Pending registration is missing Firebase metadata');
        }

        await this.emailVerificationRepository.update(verification.id, { verified: true } as any);
        await this.tempUserRepository.update({ email }, { verified: true } as any);

        // Create user without form completion timer - we'll use created_at + 10 minutes
        const saved = await this.userRepository.manager.transaction(async (manager) => {
            const newUser = manager.create(User, {
                firebase_uid: temp.firebase_uid,
                email: temp.email,
                first_name: temp.first_name,
                last_name: temp.last_name,
                role_id: temp.role_id,
                sub_account: false,
                parent_id: null,
            } as any);
            const savedUser = await manager.save(newUser);
            await manager.save(manager.create(UserProfile, {
                user_id: savedUser.id,
                display_name: `${temp.first_name} ${temp.last_name}`,
                company_name: undefined,
            }));
            return savedUser;
        });

        try {
            await this.firebaseAdmin.auth().updateUser(temp.firebase_uid, { disabled: false });
        } catch (firebaseErr: any) {
            await this.userRepository.delete(saved.id);
            throw new BadRequestException('Failed to enable Firebase user after verification');
        }

        await this.tempUserRepository.delete({ email });
        await this.emailVerificationRepository.delete({ email });

        return {
            message: 'Registration completed successfully. Please complete your profile within 10 minutes.',
            uid: temp.firebase_uid,
            userId: saved.id,
            email: temp.email,
            formExpiresAt: new Date(saved.created_at.getTime() + 10 * 60 * 1000).toISOString(),
        };
    }

    async resendRegistrationOtp(email: string) {
        let temp = await this.tempUserRepository.findOne({ where: { email } });
        if (!temp) {
            throw new BadRequestException('No pending registration found for this email');
        }
        if (temp.verified) {
            throw new BadRequestException('User is already verified');
        }

        const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes for OTP
        
        await this.tempUserRepository.update({ email }, { expires_at: expiresAt } as any);

        const generatedOtp = (Math.floor(100000 + Math.random() * 900000)).toString();
        const otpHash = this.hashOtp(generatedOtp);

        let verification = await this.emailVerificationRepository.findOne({ where: { email } });
        if (!verification) {
             await this.emailVerificationRepository.save({
                email,
                otp_hash: otpHash,
                expires_at: expiresAt,
                verified: false,
                attempts: 0,
                resend_count: 1,
            } as any);
        } else {
             await this.emailVerificationRepository.update(verification.id, {
                otp_hash: otpHash,
                expires_at: expiresAt,
                attempts: 0,
                resend_count: (verification.resend_count || 0) + 1,
            } as any);
        }

        await this.mailService.sendRegistrationVerificationOtp(email, generatedOtp);
        return { message: 'OTP resent – please verify to complete registration' };
    }

    private async createOrUpdateTempFirebaseUser(temp: TempUser, email: string, password: string): Promise<string> {
        if (temp.firebase_uid) {
            try {
                await this.firebaseAdmin.auth().updateUser(temp.firebase_uid, { password, disabled: true });
                return temp.firebase_uid;
            } catch (err: any) {
                this.logger.warn(`Failed to update existing temp Firebase user ${temp.firebase_uid}: ${((err as any)?.message) || String(err)}`);
            }
        }

        try {
            const existingUser = await this.firebaseAdmin.auth().getUserByEmail(email);
            await this.firebaseAdmin.auth().updateUser(existingUser.uid, { password, disabled: true });
            return existingUser.uid;
        } catch (error: any) {
            if (error.code !== 'auth/user-not-found') {
                this.logger.warn(`Firebase user lookup failed for ${email}: ${((error as any)?.message) || String(error)}`);
            }
        }

        const firebaseUser = await this.firebaseAdmin.auth().createUser({
            email,
            password,
            disabled: true,
        });
        return firebaseUser.uid;
    }

    private async createFirebaseUser(email: string, password: string, disabled: boolean): Promise<string> {
        try {
            const firebaseUser = await this.firebaseAdmin.auth().createUser({
                email,
                password,
                disabled,
            });
            return firebaseUser.uid;
        } catch (error: any) {
            if (error.code === 'auth/email-already-exists') {
                const existingUser = await this.firebaseAdmin.auth().getUserByEmail(email);
                await this.firebaseAdmin.auth().updateUser(existingUser.uid, { password, disabled });
                return existingUser.uid;
            }
            throw error;
        }
    }

    private async validateStateCityZip(state_id: string | undefined, city_id: string | undefined, zip: string | undefined, roleName: string) {
        if (!state_id) {
            throw new BadRequestException(`${roleName} registration requires state_id`);
        }
        if (!city_id) {
            throw new BadRequestException(`${roleName} registration requires city_id`);
        }
        if (!zip || !zip.toString().trim()) {
            throw new BadRequestException(`${roleName} registration requires zip`);
        }

        const state = await this.stateRepository.findOne({ where: { id: state_id } });
        if (!state) {
            throw new BadRequestException('State not found');
        }

        const city = await this.cityRepository.findOne({ where: { id: city_id } });
        if (!city) {
            throw new BadRequestException('City not found');
        }

        if (city.state_id !== state.id) {
            throw new BadRequestException('City does not belong to the selected state');
        }

        const zipCodes = Array.isArray(city.zip_codes) ? city.zip_codes.map(z => String(z).trim()) : [];
        if (!zipCodes.includes(zip.toString().trim())) {
            throw new BadRequestException('Zip is not valid for the selected city');
        }
    }

    private async createUserFromTemp(temp: TempUser, sub_account: boolean, parent_id?: string) {
        let roleEntity: Role | null = null;
        if (temp.role_id) {
            roleEntity = await this.roleRepository.findOne({ where: { id: temp.role_id } });
            if (!roleEntity) {
                roleEntity = await this.roleRepository.findOne({ where: { role_name: temp.role_id } });
            }
        }
        if (!roleEntity) {
            throw new BadRequestException('Role not found for registration');
        }

        const saved = await this.userRepository.manager.transaction(async (manager) => {
            const newUser = manager.create(User, {
                firebase_uid: temp.firebase_uid,
                email: temp.email,
                first_name: temp.first_name,
                last_name: temp.last_name,
                role_id: roleEntity.id,
                state_id: temp.state_id ?? null,
                city_id: temp.city_id ?? null,
                zip: temp.zip ?? null,
                sub_account,
                parent_id,
            } as any);
            const savedUser = await manager.save(newUser);
            await manager.save(manager.create(UserProfile, {
                user_id: savedUser.id,
                display_name: `${temp.first_name} ${temp.last_name}`,
                company_name: undefined,
            }));
            return savedUser;
        });

        try {
            const formDto: any = {
                companyAddress: temp.company_address,
                websiteUrl: temp.website_url,
                licenseNumber: temp.license_number,
                mobilePhone: temp.mobile_phone,
                companyPhone: temp.company_phone,
                propertyAddress: temp.property_address,
                ownerDateStart: temp.owner_date_start ? temp.owner_date_start.toISOString() : undefined,
                ownerDateEnd: temp.owner_date_end ? temp.owner_date_end.toISOString() : undefined,
                serviceTypes: temp.service_types,
                title: temp.title,
                cityOfficial: temp.city_official,
                cityAddress: temp.city_address,
                cityPhone: temp.city_phone,
            };
            await this.formsService.saveForm(saved.id, formDto, {
                company_name: null,
                city_id: temp.city_id ?? null,
                isSubAccount: sub_account,
            });
        } catch (formErr: any) {
            this.logger.error('Failed to save onboarding form: ' + String(formErr));
            try {
                await this.userRepository.delete(saved.id);
            } catch (e) {
                this.logger.error('Failed to cleanup DB user after form failure: ' + String(e));
            }
            throw formErr;
        }

        return saved;
    }

    private hashPassword(password: string): string {
        const salt = crypto.randomBytes(16).toString('hex');
        const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
        return `${salt}:${derivedKey}`;
    }

    private hashOtp(otp: string): string {
        return crypto.createHash('sha256').update(otp).digest('hex');
    }

    private async isUserFormIncomplete(user: User): Promise<{ incomplete: boolean; expired: boolean; expiresAt?: Date }> {
        // Admin users don't need forms - they're always complete
        if (user.roleEntity?.role_name === UserRole.ADMIN || user.sub_account) {
            return { incomplete: false, expired: false };
        }

        // Check if user has a completed form
        const form = await this.formRepository.findOne({ where: { userId: user.id } });
        
        if (form) {
            // User has a form, check if it's complete based on their role
            const isComplete = this.formsService.isFormCompleteForRole(
                user.roleEntity?.role_name ?? '', 
                form, 
                { company_name: user.profile?.company_name, city_id: user.city_id }, 
                user.sub_account
            );
            
            if (isComplete) {
                return { incomplete: false, expired: false };
            }
        }

        // Calculate 10 minutes from user creation
        const formExpiresAt = new Date(user.created_at.getTime() + 10 * 60 * 1000);
        const now = new Date();
        const expired = now > formExpiresAt;

        return {
            incomplete: true,
            expired,
            expiresAt: formExpiresAt
        };
    }

    async loginUser(email: string, password: string) {
        this.logger.log(`Logging in user: ${email}`);
        const apiKey = this.configService.get<string>('FIREBASE_API_KEY');

        if (!apiKey) {
            throw new BadRequestException('Firebase API Key is missing in environment');
        }

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        try {
            const response = await firstValueFrom(
                this.httpService.post(url, {
                    email,
                    password,
                    returnSecureToken: true,
                }),
            );

            const { localId, idToken, refreshToken, expiresIn } = response.data;

            // Optional: Fetch user details from Postgres to return with the token
            const user = await this.userRepository.findOne({ 
                where: { firebase_uid: localId },
                relations: ['profile', 'roleEntity']
            });
            
            if (!user) {
                 throw new UnauthorizedException('User exists in Firebase but not found in the local database. Please contact support.');
            }

            if (user.is_active === false) {
                throw new UnauthorizedException('Account disabled. Please contact your contractor.');
            }

            // Check if user has pending form completion using created_at timestamp
            const formCheck = await this.isUserFormIncomplete(user);
            if (formCheck.incomplete) {
                if (formCheck.expired) {
                    // Timer expired, delete the user
                    await this.userRepository.delete(user.id);
                    if (user.firebase_uid) {
                        try {
                            await this.firebaseAdmin.auth().deleteUser(user.firebase_uid);
                        } catch (e) {
                            this.logger.warn(`Failed to delete Firebase user ${user.firebase_uid}: ${e}`);
                        }
                    }
                    throw new UnauthorizedException('Registration expired. Please register again.');
                } else {
                    throw new UnauthorizedException({
                        error: 'FORM_NOT_COMPLETED',
                        message: 'You must complete your profile to access your account.',
                        userId: user.id,
                        formExpiresAt: formCheck.expiresAt?.toISOString(),
                        requiresFormCompletion: true
                    } as any);
                }
            }

            // Enforce onboarding form check for non-admin, non-sub-account users
            if (user.roleEntity?.role_name !== UserRole.ADMIN && !user.sub_account) {
                const form = await this.formRepository.findOne({ where: { userId: user.id } });
                if (!form || !this.formsService.isFormCompleteForRole(user.roleEntity?.role_name ?? '', form, { company_name: user.profile?.company_name, city_id: user.city_id }, user.sub_account)) {
                    throw new UnauthorizedException({
                        error: 'FORM_NOT_FILLED',
                        message: 'You must complete the onboarding form to access your account.',
                        userId: user.id,
                        requiresOnboarding: true
                    } as any);
                }
            }

            const cityData = user.city_id
                ? await this.cityRepository.findOne({ where: { id: user.city_id } })
                : null;
            
            // Compute is_directory and has_membership for login response
            const activeSub = await this.subscriptionRepository.findOne({
                where: { userId: user.id, status: 'ACTIVE' },
                relations: ['plan']
            });
            const hasMembership = !!activeSub;
            const isContractor = (user.roleEntity?.role_name === 'CONTRACTOR' || user.roleEntity?.role_name === 'MANUFACTURER');
            const isDirectory = isContractor && 
                (activeSub?.plan?.level === 'SILVER' ||
                 activeSub?.plan?.level === 'GOLD');

            // Sync is_directory and has_membership in DB
            await this.profileRepository.update({ user_id: user.id }, { is_directory: isDirectory, has_membership: hasMembership });
            
            return {
                message: 'Login successful',
                uid: localId,
                userId: user.id,
                email: user.email,
                role: user.role,
                sub_account: user.sub_account,
                parent_id: user.parent_id,
                has_membership: hasMembership,
                is_directory: isDirectory,
                company_name: user.profile?.company_name || null,
                city: cityData,
                tokens: { idToken, refreshToken, expiresIn },
            };
        } catch (error: any) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException || (error.getStatus && error.getResponse)) {
                throw error;
            }

            this.logger.error(`Login failed for ${email}: ${((error as any).response?.data?.error?.message) || ((error as any).message) || String(error)}`);

            // Security-focused messages for login
            let errorMessage = 'Invalid email or password';
            const firebaseError = error.response?.data?.error?.message;

            if (firebaseError === 'USER_DISABLED') {
                errorMessage = 'Account suspended. Please contact support.';
            }

            throw new UnauthorizedException(errorMessage);
        }
    }

    async googleLogin(idToken: string) {
        this.logger.log('Processing Google login');

        let decodedToken: any;
        let tokenType: string;

        try {
            // Method 1: Try Firebase Admin SDK first
            try {
                decodedToken = await this.firebaseAdmin.auth().verifyIdToken(idToken);
                tokenType = 'firebase';
                this.logger.log('Token verified via Firebase Admin SDK');
            } catch (firebaseError) {
                this.logger.log('Firebase verification failed, trying Google tokeninfo API');

                // Method 2: Fallback to Google tokeninfo API
                const response = await axios.get(
                    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
                );

                if (!response.data.aud || !response.data.aud.includes('googleusercontent.com')) {
                    throw new UnauthorizedException('Invalid token audience');
                }
                if (response.data.iss !== 'https://accounts.google.com') {
                    throw new UnauthorizedException('Invalid token issuer');
                }

                decodedToken = {
                    uid: response.data.sub,
                    email: response.data.email,
                    name: response.data.name,
                    picture: response.data.picture,
                    email_verified: response.data.email_verified === 'true'
                };
                tokenType = 'google';
                this.logger.log('Token verified via Google tokeninfo API');
            }

            const { uid: firebase_uid, email, name, picture } = decodedToken;

            if (!email) {
                throw new UnauthorizedException('Email not found in token');
            }

            // Helper: generate Firebase tokens from a custom token
            const getFirebaseTokens = async (uid: string) => {
                const customToken = await this.firebaseAdmin.auth().createCustomToken(uid);
                const apiKey = this.configService.get<string>('FIREBASE_API_KEY');
                const tokenResponse = await firstValueFrom(
                    this.httpService.post(
                        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
                        { token: customToken, returnSecureToken: true }
                    )
                );
                return tokenResponse.data as { idToken: string; refreshToken: string; expiresIn: string };
            };

            // ── EXISTING USER ────────────────────────────────────────────────────────
            const user = await this.userRepository.findOne({
                where: { email },
                relations: ['profile']
            });

            if (user) {
                // Update Firebase UID if different
                if (user.firebase_uid !== firebase_uid) {
                    user.firebase_uid = firebase_uid;
                    await this.userRepository.save(user);
                    await this.firebaseAdmin.firestore()
                        .collection('users').doc(firebase_uid)
                        .set({
                            firebase_uid,
                            email: user.email,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            role: user.role,
                            sub_account: user.sub_account,
                            parent_id: user.parent_id || null,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                }

                const tokens = await getFirebaseTokens(firebase_uid);

                // Role not yet assigned — prompt frontend to show role picker
                if (!user.role) {
                    return {
                        message: 'Role selection required',
                        uid: firebase_uid,
                        userId: user.id,
                        email: user.email,
                        role: null,
                        requiresRoleSelection: true,
                        tokens,
                        tokenType,
                    };
                }

                // Role assigned — enforce form check for non-admin, non-sub-account
                if (user.role !== UserRole.ADMIN && !user.sub_account) {
                    const form = await this.formRepository.findOne({ where: { userId: user.id } });
                    if (!form || !this.formsService.isFormCompleteForRole(user.role, form, { company_name: user.profile?.company_name, city_id: user.city_id }, user.sub_account)) {
                        throw new UnauthorizedException({
                            error: 'FORM_NOT_FILLED',
                            message: 'You must complete the onboarding form to access your account.',
                            userId: user.id,
                            requiresOnboarding: true
                        } as any);
                    }
                }

                const cityData = user.city_id
                    ? await this.cityRepository.findOne({ where: { id: user.city_id } })
                    : null;

                return {
                    message: 'Google login successful',
                    uid: firebase_uid,
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    sub_account: user.sub_account,
                    parent_id: user.parent_id,
                    has_membership: user.profile?.has_membership || false,
                    company_name: user.profile?.company_name || null,
                    city: cityData,
                    tokens,
                    tokenType,
                };
            }

            // ── NEW USER ─────────────────────────────────────────────────────────────
            const nameParts = name ? name.split(' ') : ['Google', 'User'];
            const first_name = nameParts[0] || 'Google';
            const last_name = nameParts.slice(1).join(' ') || 'User';
            const display_name = name || `${first_name} ${last_name}`;

            // Create user with role_id = null (no role yet)
            const newUser = this.userRepository.create({
                firebase_uid,
                email,
                first_name,
                last_name,
                role_id: null,
                sub_account: false,
            } as any);
            const savedUser = await this.userRepository.save(newUser) as unknown as User;

            // Create profile
            const newProfile = this.profileRepository.create({
                user_id: savedUser.id,
                display_name,
                profile_image_url: picture || null,
            });
            await this.profileRepository.save(newProfile);

            // Create Firestore doc with role: null
            await this.firebaseAdmin.firestore()
                .collection('users').doc(firebase_uid)
                .set({
                    firebase_uid,
                    email,
                    first_name,
                    last_name,
                    role: null,
                    sub_account: false,
                    parent_id: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

            const tokens = await getFirebaseTokens(firebase_uid);

            return {
                message: 'Role selection required',
                uid: firebase_uid,
                userId: savedUser.id,
                email,
                role: null,
                requiresRoleSelection: true,
                tokens,
                tokenType,
            };

        } catch (error: any) {
            if (error instanceof UnauthorizedException || error instanceof BadRequestException || (error.getStatus && error.getResponse)) {
                throw error;
            }
            this.logger.error(`Google login failed: ${((error as any)?.message) || String(error)}`);
            throw new UnauthorizedException('Invalid Google token or authentication failed');
        }
    }

    private async verifyAppleIdToken(idToken: string): Promise<jwt.JwtPayload> {
        let decodedHeader;
        try {
            decodedHeader = jwt.decode(idToken, { complete: true });
        } catch (e) {
            throw new BadRequestException('Invalid Apple token: unable to decode');
        }

        if (!decodedHeader || !decodedHeader.header) {
            throw new BadRequestException('Invalid Apple token: unable to decode');
        }
        if (!decodedHeader.header.kid) {
            throw new BadRequestException('Invalid Apple token: missing key ID');
        }
        const kid = decodedHeader.header.kid;

        let data;
        try {
            const response = await axios.get('https://appleid.apple.com/auth/keys');
            data = response.data;
        } catch (error) {
            throw new ServiceUnavailableException('Failed to fetch Apple public key');
        }

        const keys = data.keys as Array<{
            kty: string;
            kid: string;
            use: string;
            algs: string;
            n: string;
            e: string;
        }>;

        const matchingKey = keys.find((key) => key.kid === kid);
        if (!matchingKey) {
            throw new UnauthorizedException('Apple public key not found for the given kid');
        }

        const publicKey = crypto.createPublicKey({
            key: matchingKey,
            format: 'jwk',
        });
        const pemKey = publicKey.export({ type: 'spki', format: 'pem' }) as string;

        const audienceConfig = this.configService.get<string>('APPLE_CLIENT_ID') || '';
        const audience = audienceConfig.includes(',') ? audienceConfig.split(',').map(a => a.trim()) : audienceConfig;
        
        try {
            const payload = jwt.verify(idToken, pemKey, {
                algorithms: ['RS256'],
                issuer: 'https://appleid.apple.com',
                audience: audience as any,
            }) as jwt.JwtPayload;

            return payload;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedException('Apple token has expired');
            }
            if (error instanceof jwt.NotBeforeError) {
                throw new UnauthorizedException('Apple token is not yet valid');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new UnauthorizedException('Apple token is invalid or has been tampered');
            }
            throw new UnauthorizedException('Apple authentication failed');
        }
    }

    async loginWithApple(idToken: string) {
        this.logger.log('Processing Apple login');

        const payload = await this.verifyAppleIdToken(idToken);
        const appleUid = payload.sub;
        const email = payload.email;

        if (!appleUid) {
            throw new UnauthorizedException('Invalid token payload');
        }

        const getFirebaseTokens = async (uid: string) => {
            const customToken = await this.firebaseAdmin.auth().createCustomToken(uid);
            const apiKey = this.configService.get<string>('FIREBASE_API_KEY');
            const tokenResponse = await firstValueFrom(
                this.httpService.post(
                    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
                    { token: customToken, returnSecureToken: true }
                )
            );
            return tokenResponse.data as { idToken: string; refreshToken: string; expiresIn: string };
        };

        // ── EXISTING USER BY FIREBASE UID (SUB) ───────────────────────────────
        let user = await this.userRepository.findOne({
            where: { firebase_uid: appleUid },
            relations: ['profile']
        });

        // ── EXISTING USER BY EMAIL ───────────────────────────────────────────────
        if (!user && email) {
            user = await this.userRepository.findOne({
                where: { email },
                relations: ['profile']
            });

            if (user) {
                // If the user already exists by email but has a different firebase_uid,
                // we'll update it to the Apple UID so they can log in via Apple next time.
                if (user.firebase_uid !== appleUid) {
                    user.firebase_uid = appleUid;
                    await this.userRepository.save(user);

                    try {
                        await this.firebaseAdmin.auth().updateUser(user.firebase_uid, { email });
                    } catch (err: any) {
                        if (err.code === 'auth/user-not-found') {
                            await this.firebaseAdmin.auth().createUser({ uid: appleUid, email });
                        }
                    }
                }
            }
        }

        if (user) {
            try {
                const firebaseUser = await this.firebaseAdmin.auth().getUser(user.firebase_uid);
                if (firebaseUser.disabled) {
                    throw new ForbiddenException('This account has been disabled');
                }
            } catch (err: any) {
                if (err instanceof ForbiddenException) throw err;
                // Ignore user-not-found here since it's caught elsewhere
            }

            // Update Firestore with any changes if necessary, or just rely on existing login flow
            const tokens = await getFirebaseTokens(user.firebase_uid);

            if (!user.role) {
                return {
                    message: 'Role selection required',
                    uid: user.firebase_uid,
                    userId: user.id,
                    email: user.email,
                    role: null,
                    requiresRoleSelection: true,
                    tokens,
                    tokenType: 'apple',
                };
            }

            if (user.role !== UserRole.ADMIN && !user.sub_account) {
                const form = await this.formRepository.findOne({ where: { userId: user.id } });
                if (!form || !this.formsService.isFormCompleteForRole(user.role, form, { company_name: user.profile?.company_name, city_id: user.city_id }, user.sub_account)) {
                    throw new UnauthorizedException({
                        error: 'FORM_NOT_FILLED',
                        message: 'You must complete the onboarding form to access your account.',
                        userId: user.id,
                        requiresOnboarding: true
                    } as any);
                }
            }

            const cityData = user.city_id ? await this.cityRepository.findOne({ where: { id: user.city_id } }) : null;

            return {
                message: 'Apple login successful',
                uid: user.firebase_uid,
                userId: user.id,
                email: user.email,
                role: user.role,
                sub_account: user.sub_account,
                parent_id: user.parent_id,
                has_membership: user.profile?.has_membership || false,
                company_name: user.profile?.company_name || null,
                city: cityData,
                tokens,
                tokenType: 'apple',
            };
        }

        // ── NEW USER ─────────────────────────────────────────────────────────────
        if (!email) {
            throw new BadRequestException('Email is required for first-time Apple login');
        }

        let firebase_uid = appleUid;
        try {
            const firebaseUser = await this.firebaseAdmin.auth().getUserByEmail(email);
            // If they already exist in Firebase by email, we should use their existing uid
            // or update it to the Apple UID if possible. But Firebase doesn't allow changing UIDs.
            firebase_uid = firebaseUser.uid;
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                const firebaseUser = await this.firebaseAdmin.auth().createUser({ uid: appleUid, email });
                firebase_uid = firebaseUser.uid;
            } else {
                throw err;
            }
        }

        const newUser = this.userRepository.create({
            firebase_uid,
            email,
            first_name: 'Apple',
            last_name: 'User',
            role_id: null,
            sub_account: false,
        } as any);
        const savedUser = await this.userRepository.save(newUser) as unknown as User;

        const newProfile = this.profileRepository.create({
            user_id: savedUser.id,
            display_name: 'Apple User',
        });
        await this.profileRepository.save(newProfile);

        await this.firebaseAdmin.firestore()
            .collection('users').doc(firebase_uid)
            .set({
                firebase_uid,
                email,
                first_name: 'Apple',
                last_name: 'User',
                role: null,
                sub_account: false,
                parent_id: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        const tokens = await getFirebaseTokens(firebase_uid);

        return {
            message: 'Role selection required',
            uid: firebase_uid,
            userId: savedUser.id,
            email,
            role: null,
            requiresRoleSelection: true,
            tokens,
            tokenType: 'apple',
        };
    }

    async assignRole(userId: string, firebaseUid: string, dto: AssignRoleDto) {
        const user = await this.userRepository.findOne({ where: { id: userId }, relations: ['profile'] });
        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Block if role is already assigned AND onboarding form is complete
        // Allow re-calling if role was saved but form was never completed (partial state)
        if (user.role_id !== null) {
            const existingForm = await this.formRepository.findOne({ where: { userId } });
            const formComplete = existingForm
                ? this.formsService.isFormCompleteForRole(
                    user.role ?? '',
                    existingForm,
                    { company_name: user.profile?.company_name, city_id: user.city_id },
                    user.sub_account
                  )
                : false;

            if (formComplete) {
                throw new BadRequestException('Role has already been assigned and onboarding is complete');
            }
            // Role set but form incomplete — allow them to complete onboarding
        }

        // Resolve role entity from UUID
        const roleEntity = await this.roleRepository.findOne({ where: { id: dto.role_id } });
        if (!roleEntity) {
            throw new BadRequestException(`Role with ID "${dto.role_id}" not found`);
        }

        // Only PROPERTY_OWNER and CONTRACTOR allowed via Google sign-in role assignment
        const allowedRoles = [UserRole.PROPERTY_OWNER, UserRole.CONTRACTOR, UserRole.MANUFACTURER, UserRole.REALTOR] as string[];
        if (!allowedRoles.includes(roleEntity.role_name)) {
            throw new BadRequestException(
                `Role "${roleEntity.role_name}" cannot be assigned via this endpoint. Allowed: ${allowedRoles.join(', ')}`
            );
        }

        // Validate role-specific required fields BEFORE writing anything to DB
        const formDto = {
            companyAddress: dto.companyAddress,
            websiteUrl: dto.websiteUrl,
            licenseNumber: dto.licenseNumber,
            mobilePhone: dto.mobilePhone,
            companyPhone: dto.companyPhone,
            propertyAddress: dto.propertyAddress,
            ownerDateStart: dto.ownerDateStart,
            ownerDateEnd: dto.ownerDateEnd,
            serviceTypes: dto.serviceTypes,
            title: dto.title,
            cityOfficial: dto.cityOfficial,
            cityAddress: dto.cityAddress,
            cityPhone: dto.cityPhone,
        };
        this.formsService.validateRequiredFieldsForRole(
            roleEntity.role_name,
            formDto,
            undefined,
            { company_name: dto.company_name ?? null, city_id: dto.city_id ?? null }
        );

        // Update Postgres role_id and city_id (if provided)
        const updateData: any = { role_id: roleEntity.id };
        if (dto.city_id) {
            updateData.city_id = dto.city_id;
        }
        await this.userRepository.update(userId, updateData);

        // Update Firestore
        await this.firebaseAdmin.firestore()
            .collection('users').doc(firebaseUid)
            .update({
                role: roleEntity.role_name,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

        // Update company_name in profile if provided
        if (dto.company_name) {
            await this.profileRepository.update({ user_id: userId }, { company_name: dto.company_name });
        }

        // Save onboarding form — role-specific fields already validated above
        await this.formsService.saveForm(userId, formDto, {
            company_name: dto.company_name ?? null,
            city_id: dto.city_id ?? null,
            isSubAccount: false,
        });

        return {
            message: 'Role assigned and onboarding complete',
            userId,
            role: roleEntity.role_name,
        };
    }

    async createCustomToken(uid: string) {
        return this.firebaseAdmin.auth().createCustomToken(uid);
    }

    async refreshToken(refreshToken: string) {
        this.logger.log(`Refreshing token`);
        const apiKey = this.configService.get<string>('FIREBASE_API_KEY');

        if (!apiKey) {
            throw new BadRequestException('Firebase API Key is missing in environment');
        }

        const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;

        try {
            const response = await firstValueFrom(
                this.httpService.post(
                    url,
                    new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                    }).toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                    },
                ),
            );

            const {
                id_token: idToken,
                refresh_token: newRefreshToken,
                expires_in: expiresIn,
                user_id: localId,
            } = response.data;

            return {
                message: 'Token refreshed successfully',
                uid: localId,
                tokens: {
                    idToken,
                    refreshToken: newRefreshToken,
                    expiresIn,
                },
            };
        } catch (error: any) {
            this.logger.error(`Token refresh failed: ${((error as any).response?.data?.error?.message) || ((error as any).message) || String(error)}`);
            
            let errorMessage = 'Token refresh failed';
            const firebaseError = error.response?.data?.error?.message;

            if (firebaseError === 'INVALID_REFRESH_TOKEN') {
                errorMessage = 'The refresh token is invalid or has expired.';
            } else if (firebaseError === 'TOKEN_EXPIRED') {
                errorMessage = 'The token has expired. Please log in again.';
            } else if (firebaseError === 'USER_DISABLED') {
                errorMessage = 'Account suspended. Please contact support.';
            }

            throw new UnauthorizedException(errorMessage);
        }
    }

    async forgotPassword(email: string) {
        // 1. Find user by email
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new BadRequestException('If an account with this email exists, a password reset OTP will be sent.');
        }

        // 2. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Set expiration of 3 minutes
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        // 4. Save to password_resets
        const resetRecord = this.passwordResetRepository.create({
            email,
            otp,
            expires_at: expiresAt,
            is_used: false,
            is_verified: false,
        });
        await this.passwordResetRepository.save(resetRecord);

        // 5. Send via nodemailer
        await this.mailService.sendPasswordResetOtp(email, otp);

        return { message: 'OTP sent to your email.' };
    }

    async verifyOtp(email: string, otp: string) {
        // 1. Validate email and OTP
        const record = await this.passwordResetRepository.findOne({
            where: { email, otp, is_used: false },
            order: { created_at: 'DESC' }
        });

        if (!record) {
            throw new BadRequestException('Invalid or expired OTP.');
        }

        // 2. Check expiration
        if (new Date() > record.expires_at) {
            throw new BadRequestException('OTP has expired.');
        }

        // 3. Generate reset_token (UUID)
        const reset_token = uuidv4();
        record.is_verified = true;
        record.reset_token = reset_token;
        await this.passwordResetRepository.save(record);

        return { 
            message: 'OTP verified successfully.',
            reset_token 
        };
    }

    async getPasswordResetByToken(reset_token: string) {
        return await this.passwordResetRepository.findOne({
            where: { reset_token }
        });
    }

    async resetPassword(reset_token: string, newPassword: string) {
        // 1. Check validity and expoery of token
        const record = await this.passwordResetRepository.findOne({
            where: { reset_token, is_verified: true, is_used: false }
        });

        if (!record) {
            throw new BadRequestException('Invalid or expired reset token.');
        }

        // Use 10 minutes limit for reset token since its creation
        const tokenExpiry = new Date(record.created_at.getTime() + 10 * 60 * 1000);
        if (new Date() > tokenExpiry) {
            throw new BadRequestException('Reset token has expired.');
        }

        // 2. Update user's password in Firebase
        const user = await this.userRepository.findOne({ where: { email: record.email } });
        if (!user) {
            throw new BadRequestException('User not found.');
        }

        await this.firebaseAdmin.auth().updateUser(user.firebase_uid, {
            password: newPassword
        });

        // 3. Mark reset record as is_used = true
        record.is_used = true;
        await this.passwordResetRepository.save(record);

        return { message: 'Password reset successfully.' };
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string, currentToken?: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException('User not found.');
        }

        const apiKey = this.configService.get<string>('FIREBASE_API_KEY');
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        try {
            // 1. Verify: Attempt Firebase sign-in
            await firstValueFrom(
                this.httpService.post(url, {
                    email: user.email,
                    password: currentPassword,
                    returnSecureToken: true,
                }),
            );

            // 2. Update: Use firebase-admin to set newPassword
            await this.firebaseAdmin.auth().updateUser(user.firebase_uid, {
                password: newPassword
            });

            // 3. Security: Blacklist the current token immediately
            if (currentToken) {
                const tokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
                const blacklistEntry = this.refreshTokenRepository.create({
                    token: tokenHash,
                    user_id: userId,
                    is_revoked: true,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
                });
                await this.refreshTokenRepository.save(blacklistEntry);
            }

            // 4. Security: Mark ALL other active tokens as revoked in DB
            await this.refreshTokenRepository.update(
                { user_id: userId, is_revoked: false },
                { is_revoked: true }
            );

            // 5. Firebase: Revoke refresh tokens
            await this.firebaseAdmin.auth().revokeRefreshTokens(user.firebase_uid);

            return { message: 'Password changed successfully and all sessions revoked.' };
        } catch (error: any) {
            throw new BadRequestException('Invalid current password.');
        }
    }

    async logout(userId: string, idToken: string) {
        // 1. Hash the user's current idToken using SHA-256
        const hashedToken = crypto.createHash('sha256').update(idToken).digest('hex');

        // 2. Store the hash in refresh_tokens table as revoked
        const blacklistEntry = this.refreshTokenRepository.create({
            token: hashedToken,
            user_id: userId,
            is_revoked: true,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
        });
        await this.refreshTokenRepository.save(blacklistEntry);

        return { message: 'Logged out successfully.' };
    }

    async completeUserForm(userId: string, formDto: any) {
        const user = await this.userRepository.findOne({ 
            where: { id: userId },
            relations: ['roleEntity', 'profile']
        });
        
        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Admin users don't need to complete forms
        if (user.roleEntity?.role_name === UserRole.ADMIN) {
            throw new BadRequestException('Admin users do not need to complete forms');
        }

        // Check if form completion timer has expired using created_at + 10 minutes
        const formExpiresAt = new Date(user.created_at.getTime() + 10 * 60 * 1000);
        if (formExpiresAt < new Date()) {
            // Delete the user as they missed the 10-minute window (but not if they're admin)
            await this.userRepository.delete(userId);
            if (user.firebase_uid) {
                try {
                    await this.firebaseAdmin.auth().deleteUser(user.firebase_uid);
                } catch (e) {
                    this.logger.warn(`Failed to delete Firebase user ${user.firebase_uid}: ${e}`);
                }
            }
            throw new BadRequestException('Form completion window expired. Please register again.');
        }

        // Validate role-specific requirements
        if (user.roleEntity?.role_name === UserRole.PROPERTY_OWNER || user.roleEntity?.role_name === UserRole.REALTOR) {
            await this.validateStateCityZip(formDto.state_id, formDto.city_id, formDto.zip, user.roleEntity.role_name);
        }

        // Update user with location data if provided
        const updateData: any = {};
        if (formDto.state_id) updateData.state_id = formDto.state_id;
        if (formDto.city_id) updateData.city_id = formDto.city_id;
        if (formDto.zip) updateData.zip = formDto.zip;
        
        await this.userRepository.update(userId, updateData);

        // Update profile company name if provided
        if (formDto.company_name) {
            await this.profileRepository.update({ user_id: userId }, { company_name: formDto.company_name });
        }

        // Save the form
        const createFormDto = {
            companyAddress: formDto.companyAddress,
            websiteUrl: formDto.websiteUrl,
            licenseNumber: formDto.licenseNumber,
            mobilePhone: formDto.mobilePhone,
            companyPhone: formDto.companyPhone,
            propertyAddress: formDto.propertyAddress,
            ownerDateStart: formDto.ownerDateStart,
            ownerDateEnd: formDto.ownerDateEnd,
            serviceTypes: formDto.serviceTypes,
            title: formDto.title,
            cityOfficial: formDto.cityOfficial,
            cityAddress: formDto.cityAddress,
            cityPhone: formDto.cityPhone,
        };

        await this.formsService.saveForm(userId, createFormDto, {
            company_name: formDto.company_name ?? null,
            city_id: formDto.city_id ?? null,
            isSubAccount: false,
        });

        return {
            message: 'Profile completed successfully. You can now log in.',
            userId,
            completedAt: new Date().toISOString(),
        };
    }
}
