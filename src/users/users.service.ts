import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { UserProfile } from '../entities/user-profile.entity';
import { User, UserRole } from '../entities/user.entity';
import { Subscription as SubscriptionEntity } from '../entities/subscription.entity';
import { UserForm } from '../entities/form.entity';
import { FormsService } from '../forms/forms.service';
import { CreateFormDto } from '../forms/dto/create-form.dto';
import { ServiceProvided } from '../entities/service-provided.entity';
import { UpdateProfileDto, ProcessedUpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FIREBASE_ADMIN_INJECT } from '../firebase/firebase.module';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { City } from '../entities/city.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserProfile)
        private profileRepository: Repository<UserProfile>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(SubscriptionEntity)
        private subscriptionRepository: Repository<SubscriptionEntity>,
        @InjectRepository(UserForm)
        private formRepository: Repository<UserForm>,
        private formsService: FormsService,
        @InjectRepository(ServiceProvided)
        private serviceProvidedRepository: Repository<ServiceProvided>,
        @Inject(FIREBASE_ADMIN_INJECT)
        private firebaseAdmin: admin.app.App,
    ) { }

    async getProfile(userId: string): Promise<any> {
        const profile = await this.profileRepository.findOne({ 
            where: { user_id: userId },
            relations: ['user', 'user.roleEntity']
        });
        if (!profile) {
            throw new NotFoundException('User profile not found');
        }
        
        // Get current subscription details if exists
        let currentSubscription: SubscriptionEntity | null = null;
        if (profile.current_subscription_id) {
            currentSubscription = await this.subscriptionRepository.findOne({
                where: { id: profile.current_subscription_id },
                relations: ['plan']
            });
        }
        
        // Fetch user form details if exists
        const userForm = await this.formRepository.findOne({
            where: { userId }
        });
        
        // Check if contractor has directory profile
        let hasDirectoryProfile = false;
        if (profile.user?.roleEntity?.role_name === 'CONTRACTOR') {
            const directoryProfile = await this.profileRepository.manager.findOne('contractor_directory_profiles', {
                where: { contractorId: userId, isActive: true }
            });
            hasDirectoryProfile = !!directoryProfile;
        }
        
        // Compute is_directory: contractor with STANDARD/PREMIUM active subscription AND has directory profile
        const isContractor = profile.user?.roleEntity?.role_name === 'CONTRACTOR';
        const hasValidSubscription = currentSubscription?.status === 'ACTIVE' &&
            (currentSubscription.plan?.level === 'SILVER' ||
             currentSubscription.plan?.level === 'GOLD');
        const isDirectory = isContractor && hasValidSubscription && hasDirectoryProfile;

        // Sync is_directory in DB if it differs
        if (profile.is_directory !== isDirectory) {
            await this.profileRepository.update({ user_id: userId }, { is_directory: isDirectory });
            profile.is_directory = isDirectory;
        }
        
        // Return profile with user fields, subscription details, and form details
        return {
            ...profile,
            is_directory: isDirectory,
            first_name: profile.user?.first_name || null,
            last_name: profile.user?.last_name || null,
            email: profile.user?.email || null,
            role: profile.user?.role || null,
            level: currentSubscription?.plan?.level || 'FREE',
            current_subscription: currentSubscription ? {
                id: currentSubscription.id,
                status: currentSubscription.status,
                billing_cycle: currentSubscription.billingCycle,
                current_period_end: currentSubscription.currentPeriodEnd,
                plan: currentSubscription.plan
            } : null,
            form_details: userForm ? {
                id: userForm.id,
                companyAddress: userForm.companyAddress,
                websiteUrl: userForm.websiteUrl,
                licenseNumber: userForm.licenseNumber,
                mobilePhone: userForm.mobilePhone,
                companyPhone: userForm.companyPhone,
                propertyAddress: userForm.propertyAddress,
                ownerDateStart: userForm.ownerDateStart,
                ownerDateEnd: userForm.ownerDateEnd,
                serviceTypes: userForm.serviceTypes,
                title: userForm.title,
                cityOfficial: userForm.cityOfficial,
                cityAddress: userForm.cityAddress,
                cityPhone: userForm.cityPhone,
                createdAt: userForm.createdAt,
                updatedAt: userForm.updatedAt
            } : null
        };
    }

    async updateProfile(userId: string, firebaseUid: string, data: Partial<ProcessedUpdateProfileDto>, file?: Express.Multer.File): Promise<UserProfile> {
        let profileImageUrl = data.profile_image_url;

        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['parent', 'roleEntity']
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // CITY_INSPECTOR cannot update city_id
        if (user.roleEntity?.role_name === UserRole.CITY_INSPECTOR && data.city_id !== undefined) {
            throw new BadRequestException('CITY_INSPECTOR role cannot update city_id');
        }

        // Sub-accounts under insurance company cannot change company_name
        if (data.company_name && user.sub_account && user.parent?.role === UserRole.INSURANCE_COMPANY) {
            delete data.company_name;
        }

        if (file) {
            const uploadDir = path.join(process.cwd(), 'uploads', 'profiles');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            const fileExt = path.extname(file.originalname);
            const fileName = `${userId}_${Date.now()}${fileExt}`;
            fs.writeFileSync(path.join(uploadDir, fileName), file.buffer);
            profileImageUrl = `/uploads/profiles/${fileName}`;
        }

        // Extract form-related fields
        const {
            first_name,
            last_name,
            city_id,
            state_id,
            companyAddress,
            websiteUrl,
            mobilePhone,
            companyPhone,
            propertyAddress,
            ownerDateStart,
            ownerDateEnd,
            serviceTypes,
            title,
            cityOfficial,
            cityAddress,
            cityPhone,
            ...profileData
        } = data as any;

        // Update user table (first_name, last_name, city_id, state_id)
        const userUpdateData: any = {};
        if (first_name !== undefined) userUpdateData.first_name = first_name;
        if (last_name !== undefined) userUpdateData.last_name = last_name;
        if (city_id !== undefined) userUpdateData.city_id = city_id;
        if (state_id !== undefined) userUpdateData.state_id = state_id;

        // Validation for city belonging to state
        const targetCityId = city_id !== undefined ? city_id : user.city_id;
        const targetStateId = state_id !== undefined ? state_id : user.state_id;

        if (targetCityId && targetStateId) {
            const cityExists = await this.userRepository.manager.findOne(City, {
                where: { id: targetCityId, state_id: targetStateId }
            });
            if (!cityExists) {
                throw new BadRequestException('The selected city does not belong to the selected state');
            }
        }

        if (Object.keys(userUpdateData).length > 0) {
            await this.userRepository.update({ id: userId }, userUpdateData);
        }

        // Update profile table
        const updateData: any = { ...profileData };
        if (profileImageUrl) updateData.profile_image_url = profileImageUrl;
        await this.profileRepository.update({ user_id: userId }, updateData);

        // Update or create form record with form-related fields
        const formUpdateData: any = {};
        if (companyAddress !== undefined) formUpdateData.companyAddress = companyAddress;
        if (websiteUrl !== undefined) formUpdateData.websiteUrl = websiteUrl;
        if (mobilePhone !== undefined) formUpdateData.mobilePhone = mobilePhone;
        if (companyPhone !== undefined) formUpdateData.companyPhone = companyPhone;
        if (propertyAddress !== undefined) formUpdateData.propertyAddress = propertyAddress;
        if (ownerDateStart !== undefined) formUpdateData.ownerDateStart = ownerDateStart ? new Date(ownerDateStart) : null;
        if (ownerDateEnd !== undefined) formUpdateData.ownerDateEnd = ownerDateEnd ? new Date(ownerDateEnd) : null;
        if (serviceTypes !== undefined) {
            let parsedServiceTypes: string[] = [];
            if (typeof serviceTypes === 'string') {
                // Try to parse JSON array string, but fall back to comma-separated list
                try {
                    const maybe = JSON.parse(serviceTypes);
                    if (Array.isArray(maybe)) {
                        parsedServiceTypes = maybe.map(String);
                    } else {
                        parsedServiceTypes = serviceTypes.split(',').map(s => s.trim()).filter(Boolean).map(String);
                    }
                } catch (e) {
                    // Not valid JSON — accept comma-separated values
                    parsedServiceTypes = serviceTypes.split(',').map(s => s.trim()).filter(Boolean).map(String);
                }
            } else if (Array.isArray(serviceTypes)) {
                parsedServiceTypes = serviceTypes.map(String);
            }
            
            // Validate that all serviceType IDs exist in services_provided table
            if (parsedServiceTypes.length > 0) {
                // Validate UUID format for each provided service ID before querying
                const invalidUuids = parsedServiceTypes.filter(id => {
                    try {
                        validateUUID(id, 'service id');
                        return false;
                    } catch (e) {
                        return true;
                    }
                });
                if (invalidUuids.length > 0) {
                    throw new BadRequestException(`Invalid UUID(s) in serviceTypes: ${invalidUuids.join(', ')}`);
                }

                const existingServices = await this.serviceProvidedRepository.find({
                    where: { id: In(parsedServiceTypes) }
                });
                if (existingServices.length !== parsedServiceTypes.length) {
                    throw new BadRequestException('One or more service IDs do not exist in the services_provided table');
                }
            }
            
            formUpdateData.serviceTypes = parsedServiceTypes;
        }
        if (title !== undefined) formUpdateData.title = title;
        if (cityOfficial !== undefined) formUpdateData.cityOfficial = cityOfficial;
        if (cityAddress !== undefined) formUpdateData.cityAddress = cityAddress;
        if (cityPhone !== undefined) formUpdateData.cityPhone = cityPhone;

        if (Object.keys(formUpdateData).length > 0) {
            // Validate fields using FormsService to mirror registration checks
            const existingForm = await this.formRepository.findOne({ where: { userId } });
            const profileRecord = await this.profileRepository.findOne({ where: { user_id: userId } });

            const createDto: CreateFormDto = {
                companyAddress: formUpdateData.companyAddress,
                websiteUrl: formUpdateData.websiteUrl,
                licenseNumber: undefined,
                mobilePhone: formUpdateData.mobilePhone,
                companyPhone: formUpdateData.companyPhone,
                propertyAddress: formUpdateData.propertyAddress,
                ownerDateStart: ownerDateStart,
                ownerDateEnd: ownerDateEnd,
                serviceTypes: formUpdateData.serviceTypes,
                title: formUpdateData.title,
                cityOfficial: formUpdateData.cityOfficial,
                cityAddress: formUpdateData.cityAddress,
                cityPhone: formUpdateData.cityPhone,
            } as any;

            // Extra context needed for some role validations
            const extra = {
                company_name: profileRecord?.company_name ?? null,
                city_id: user.city_id ?? null,
                isSubAccount: user.sub_account
            };

            // Enforce 10-digit format for mobilePhone and cityPhone when provided
            if (createDto.mobilePhone !== undefined && createDto.mobilePhone !== null) {
                if (!/^\d{10}$/.test(String(createDto.mobilePhone))) {
                    throw new BadRequestException('mobilePhone must be exactly 10 digits');
                }
            }
            if (createDto.cityPhone !== undefined && createDto.cityPhone !== null) {
                if (!/^\d{10}$/.test(String(createDto.cityPhone))) {
                    throw new BadRequestException('cityPhone must be exactly 10 digits');
                }
            }

            // Run validations (will throw BadRequestException on failure)
            this.formsService.validateRequiredFieldsForRole(user.role ?? '', createDto, existingForm ?? undefined, extra);
            await this.formsService.validateUniqueFormFields(createDto, userId);

            if (existingForm) {
                await this.formRepository.update({ userId }, formUpdateData);
            } else {
                await this.formRepository.save({
                    userId,
                    ...formUpdateData
                });
            }
        }

        return this.getProfile(userId);
    }

    async countSubAccounts(parentId: string): Promise<number> {
        return await this.userRepository.count({ where: { parent_id: parentId, sub_account: true } });
    }

    async updateUser(userId: string, data: Partial<UpdateUserDto>): Promise<User> {
        // Update user fields in users table
        await this.userRepository.update({ id: userId }, data);
        const updatedUser = await this.userRepository.findOne({ 
            where: { id: userId },
            relations: ['profile']
        });
        
        if (!updatedUser) {
            throw new NotFoundException('User not found');
        }
        
        return updatedUser;
    }

    async getAllUsers(filters: { id?: string, first_name?: string, last_name?: string, role?: string, page?: number, limit?: number } = {}): Promise<{ data: any[], total: number }> {
        const { id, first_name, last_name, role, page = 1, limit } = filters;
        
        const skip = limit ? (page - 1) * limit : undefined;
        
        const query = this.userRepository.createQueryBuilder('user')
            .leftJoinAndSelect('user.profile', 'profile')
            .leftJoinAndSelect('user.city', 'city')
            .leftJoinAndSelect('user.roleEntity', 'roleEntity')
            .orderBy('user.created_at', 'DESC');

        if (id) {
            query.andWhere('user.id = :id', { id });
        }

        if (first_name) {
            query.andWhere('user.first_name ILIKE :first_name', { first_name: `${first_name}%` });
        }

        if (last_name) {
            query.andWhere('user.last_name ILIKE :last_name', { last_name: `${last_name}%` });
        }

        if (role) {
            query.andWhere('roleEntity.role_name = :role', { role });
        }

        if (limit !== undefined) {
            query.take(limit);
        }
        if (skip !== undefined) {
            query.skip(skip);
        }
        const [users, total] = await query.getManyAndCount();

        const mappedUsers = users.map(user => ({
            id: user.id,
            firebase_uid: user.firebase_uid,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            sub_account: user.sub_account,
            city_id: user.city_id || null,
            city_name: (user as any).city?.name || null,
            created_at: user.created_at,
            updated_at: user.updated_at,
            profile: user.profile ? {
                display_name: user.profile.display_name,
                // phone_number removed from profile audit after migration
                company_name: user.profile.company_name,
                profile_image_url: user.profile.profile_image_url
            } : null
        }));

        return { data: mappedUsers, total };
    }

    async getStaffByParent(boss: User, staffId?: string): Promise<User[]> {
        const where: any = { parent_id: boss.id, sub_account: true };

        if (staffId) {
            where.id = staffId;
            delete where.parent_id;
            delete where.sub_account;
        }

        const staff = await this.userRepository.find({
            where,
            relations: ['profile', 'city', 'parent'],
            order: { created_at: 'DESC' }
        });

        return staff.map(member => {
            const { parent, ...memberData } = member;
            return { ...memberData, parent: parent ? { email: parent.email } : null };
        }) as any;
    }

    async findUserById(userId: string): Promise<User | null> {
        try {
            const user = await this.userRepository.findOne({
                where: { id: userId }
            });
            return user;
        } catch (error) {
            return null;
        }
    }

    async findUserByEmail(email: string): Promise<User | null> {
        try {
            const user = await this.userRepository.findOne({
                where: { email },
                relations: ['profile']
            });
            return user;
        } catch (error) {
            return null;
        }
    }

    async canManageUser(currentUser: User, targetUserId: string): Promise<{ allowed: boolean; targetUserRole?: string | null }> {
        const targetUser = await this.findUserById(targetUserId);
        
        if (!targetUser) {
            throw new NotFoundException('Target user not found');
        }

        // Admin can manage any user
        if (currentUser.role === UserRole.ADMIN) {
            return { allowed: true, targetUserRole: targetUser.role };
        }

        // City Inspector can only manage users in their city (sub_account users)
        if (currentUser.role === UserRole.CITY_INSPECTOR) {
            if (currentUser.city_id && targetUser.city_id === currentUser.city_id && targetUser.sub_account) {
                return { allowed: true, targetUserRole: targetUser.role };
            }
            return { allowed: false, targetUserRole: targetUser.role };
        }

        // Insurance Company and Contractor can only manage their own sub-accounts (by parent_id)
        if (currentUser.role === UserRole.INSURANCE_COMPANY || currentUser.role === UserRole.CONTRACTOR) {
            if (targetUser.parent_id === currentUser.id && targetUser.sub_account) {
                return { allowed: true, targetUserRole: targetUser.role };
            }
            return { allowed: false, targetUserRole: targetUser.role };
        }

        // Other roles cannot manage users
        return { allowed: false, targetUserRole: targetUser.role };
    }

    async updateUserWithProfile(userId: string, data: Partial<ProcessedUpdateProfileDto>, file?: Express.Multer.File): Promise<any> {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // city_id and state_id live on the users table — update them directly before calling updateProfile
        const userUpdateData: any = {};
        if (data.city_id !== undefined) userUpdateData.city_id = data.city_id;
        if (data.state_id !== undefined) userUpdateData.state_id = data.state_id;
        
        if (Object.keys(userUpdateData).length > 0) {
            await this.userRepository.update({ id: userId }, userUpdateData);
        }

        // Use the existing updateProfile method which handles both user and profile updates
        const { city_id, state_id, ...profileData } = data;
        const updatedProfile = await this.updateProfile(userId, user.firebase_uid, profileData, file);
        
        // Return the updated user with profile
        const updatedUser = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['profile', 'city']
        });
        
        return {
            ...updatedUser,
            profile: updatedProfile
        };
    }

    async deleteUser(userId: string): Promise<void> {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        
        // Delete from Firebase
        if (user.firebase_uid) {
            try {
                await this.firebaseAdmin.auth().deleteUser(user.firebase_uid);
            } catch (error) {
                console.error(`Failed to delete user ${userId} from Firebase:`, error);
            }
        }
        
        // Delete user profile first (due to foreign key constraint)
        await this.profileRepository.delete({ user_id: userId });
        
        // Delete user
        await this.userRepository.delete({ id: userId });
    }
}