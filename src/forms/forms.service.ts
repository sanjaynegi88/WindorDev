import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserForm } from '../entities/form.entity';
import { User, UserRole } from '../entities/user.entity';
import { ServiceProvided } from '../entities/service-provided.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Injectable()
export class FormsService {
    constructor(
        @InjectRepository(UserForm)
        private readonly formRepository: Repository<UserForm>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(ServiceProvided)
        private readonly serviceProvidedRepository: Repository<ServiceProvided>,
    ) {}

    private async resolveServiceTypes(ids: any): Promise<string[]> {
        // Normalize input: allow JSON string, comma-separated, or array
        let parsedIds: string[] = [];
        if (ids === undefined || ids === null) return [];
        if (Array.isArray(ids)) {
            parsedIds = ids as string[];
        } else if (typeof ids === 'string') {
            // Try JSON parse first
            try {
                const maybe = JSON.parse(ids);
                if (Array.isArray(maybe)) {
                    parsedIds = maybe;
                } else {
                    // fallback: comma-separated
                    parsedIds = ids.split(',').map(s => s.trim()).filter(Boolean);
                }
            } catch (e) {
                // Not JSON — treat as comma-separated list
                parsedIds = ids.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else {
            // Unexpected type
            throw new BadRequestException('serviceTypes must be an array of UUIDs or a JSON array string');
        }

        if (parsedIds.length === 0) return [];

        // Validate UUID format early to avoid DB query errors
        const invalid = parsedIds.filter(id => {
            try {
                validateUUID(id, 'service id');
                return false;
            } catch (e) {
                return true;
            }
        });
        if (invalid.length > 0) {
            throw new BadRequestException(`Invalid UUID(s) in serviceTypes: ${invalid.join(', ')}`);
        }

        const found = await this.serviceProvidedRepository.find({
            where: { id: In(parsedIds) },
        });

        // Check all provided IDs actually exist
        if (found.length !== parsedIds.length) {
            const foundIds = new Set(found.map(s => s.id));
            const missing = parsedIds.filter(id => !foundIds.has(id));
            throw new BadRequestException(
                `The following service type IDs were not found: ${missing.join(', ')}`
            );
        }

        // Return IDs in the same order as the input
        return parsedIds;
    }

    validateRequiredFieldsForRole(
        role: string,
        dto: CreateFormDto,
        existingForm?: UserForm,
        extra?: { company_name?: string | null; city_id?: string | null; isSubAccount?: boolean },
    ): void {
        // Sub-accounts inherit their parent's onboarding — skip validation
        if (extra?.isSubAccount) return;

        // Merge existing form values with incoming DTO to get the effective state
        const effective = {
            companyAddress: dto.companyAddress ?? existingForm?.companyAddress,
            websiteUrl: dto.websiteUrl ?? existingForm?.websiteUrl,
            mobilePhone: dto.mobilePhone ?? existingForm?.mobilePhone,
            companyPhone: dto.companyPhone ?? existingForm?.companyPhone,
            propertyAddress: dto.propertyAddress ?? existingForm?.propertyAddress,
            ownerDateStart: dto.ownerDateStart ?? existingForm?.ownerDateStart,
            ownerDateEnd: dto.ownerDateEnd ?? existingForm?.ownerDateEnd,
            serviceTypes: dto.serviceTypes ?? existingForm?.serviceTypes,
            title: dto.title ?? existingForm?.title,
            cityOfficial: dto.cityOfficial ?? existingForm?.cityOfficial,
            cityAddress: dto.cityAddress ?? existingForm?.cityAddress,
            cityPhone: dto.cityPhone ?? existingForm?.cityPhone,
        };

        if (role === UserRole.CONTRACTOR || role === UserRole.MANUFACTURER) {
            const missing: string[] = [];
            if (!effective.companyAddress) missing.push('companyAddress');
            if (!effective.websiteUrl) missing.push('websiteUrl');
            if (!effective.mobilePhone) missing.push('mobilePhone');
            if (!effective.companyPhone) missing.push('companyPhone');
            if (!effective.serviceTypes || effective.serviceTypes.length === 0) missing.push('serviceTypes');
            if (missing.length > 0) {
                throw new BadRequestException(
                    `The following fields are required for contractor and manufacturer: ${missing.join(', ')}`
                );
            }
        }

        if (role === UserRole.PROPERTY_OWNER || role === 'REALTOR') {
            const missing: string[] = [];
            if (!effective.propertyAddress) missing.push('propertyAddress');
            if (!effective.ownerDateStart) missing.push('ownerDateStart');
            if (!effective.mobilePhone) missing.push('mobilePhone');
            if (missing.length > 0) {
                throw new BadRequestException(
                    `The following fields are required for ${role}: ${missing.join(', ')}`
                );
            }
        }

        if (role === UserRole.CITY_INSPECTOR) {
            const missing: string[] = [];
            if (!extra?.city_id) missing.push('city_id');
            if (!effective.cityOfficial) missing.push('cityOfficial');
            if (!effective.cityAddress) missing.push('cityAddress');
            if (!effective.cityPhone) missing.push('cityPhone');
            if (!effective.title) missing.push('title');
            if (missing.length > 0) {
                throw new BadRequestException(
                    `The following fields are required for ${role}: ${missing.join(', ')}`
                );
            }
        }

        if (role === UserRole.INSURANCE_COMPANY) {
            const missing: string[] = [];
            if (!extra?.company_name?.trim()) missing.push('company_name');
            if (!effective.companyAddress) missing.push('companyAddress');
            if (!effective.websiteUrl) missing.push('websiteUrl');
            if (!effective.mobilePhone) missing.push('mobilePhone');
            if (!effective.companyPhone) missing.push('companyPhone');
            if (!effective.title) missing.push('title');
            if (missing.length > 0) {
                throw new BadRequestException(
                    `The following fields are required for ${role}: ${missing.join(', ')}`
                );
            }
        }
    }

    isFormCompleteForRole(role: string, form: UserForm, profile?: { company_name?: string | null; city_id?: string | null }, isSubAccount: boolean = false): boolean {
        // Sub-accounts inherit their parent's onboarding — no form completion required
        if (isSubAccount) return true;
        if (role === UserRole.CONTRACTOR || role === 'MANUFACTURER') {
            return !!(
                form.companyAddress &&
                form.websiteUrl &&
                form.mobilePhone &&
                form.companyPhone &&
                form.serviceTypes &&
                form.serviceTypes.length > 0
            );
        }
        if (role === UserRole.PROPERTY_OWNER || role === 'REALTOR') {
            return !!(form.propertyAddress && form.ownerDateStart && form.mobilePhone);
        }
        if (role === UserRole.CITY_INSPECTOR) {
            return !!(form.cityOfficial && form.cityAddress && form.cityPhone && form.title && profile?.city_id);
        }
        if (role === UserRole.INSURANCE_COMPANY) {
            return !!(
                form.companyAddress &&
                form.websiteUrl &&
                form.mobilePhone &&
                form.companyPhone &&
                form.title &&
                profile?.company_name
            );
        }
        // Other roles — form existence is enough
        return true;
    }

    async saveForm(userId: string, dto: CreateFormDto, extra?: { company_name?: string | null; city_id?: string | null; isSubAccount?: boolean }): Promise<UserForm> {
        // 1. Verify user exists
        const user = await this.userRepository.findOne({ 
            where: { id: userId },
            relations: ['roleEntity']
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // 2. Enforce only for non-admin roles
        if (user.role === UserRole.ADMIN) {
            throw new BadRequestException('Onboarding form is not required/allowed for ADMIN users.');
        }

        // 3. Look up if form already exists for this user
        let form = await this.formRepository.findOne({ where: { userId } });

        // 4. Validate websiteUrl uniqueness if provided
        if (dto.websiteUrl) {
            const existingWebsite = await this.formRepository.findOne({
                where: { websiteUrl: dto.websiteUrl }
            });
            if (existingWebsite && existingWebsite.userId !== userId) {
                throw new BadRequestException('This website URL is already associated with another account.');
            }
        }

        // 5. Validate mobilePhone uniqueness if provided
        if (dto.mobilePhone) {
            const existingMobile = await this.formRepository.findOne({
                where: { mobilePhone: dto.mobilePhone }
            });
            if (existingMobile && existingMobile.userId !== userId) {
                throw new BadRequestException('This mobile phone number is already associated with another account.');
            }
        }

        // 6. Validate companyPhone uniqueness if provided
        if (dto.companyPhone) {
            const existingCompanyPhone = await this.formRepository.findOne({
                where: { companyPhone: dto.companyPhone }
            });
            if (existingCompanyPhone && existingCompanyPhone.userId !== userId) {
                throw new BadRequestException('This company phone number is already associated with another account.');
            }
        }

        // 7. Resolve serviceType IDs → [{id, service_name}]
        const resolvedServiceTypes = dto.serviceTypes !== undefined
            ? await this.resolveServiceTypes(dto.serviceTypes)
            : undefined;

        // 8. Validate role-specific required fields — skip for sub-accounts (they inherit from parent)
        if (!extra?.isSubAccount) {
            this.validateRequiredFieldsForRole(user.role ?? '', dto, form ?? undefined, extra);
            await this.validateUniqueFormFields(dto, userId);
        }

        const ownerDateStart = dto.ownerDateStart ? new Date(dto.ownerDateStart) : null;
        const ownerDateEnd = dto.ownerDateEnd ? new Date(dto.ownerDateEnd) : null;

        if (form) {
            // Update existing form
            form.companyAddress = dto.companyAddress ?? form.companyAddress;
            form.websiteUrl = dto.websiteUrl ?? form.websiteUrl;
            form.licenseNumber = dto.licenseNumber ?? form.licenseNumber;
            form.mobilePhone = dto.mobilePhone ?? form.mobilePhone;
            form.companyPhone = dto.companyPhone ?? form.companyPhone;
            form.propertyAddress = dto.propertyAddress ?? form.propertyAddress;
            form.ownerDateStart = ownerDateStart ?? form.ownerDateStart;
            form.ownerDateEnd = ownerDateEnd ?? form.ownerDateEnd;
            form.serviceTypes = resolvedServiceTypes ?? form.serviceTypes;
            form.title = dto.title ?? form.title;
            form.cityOfficial = dto.cityOfficial ?? form.cityOfficial;
            form.cityAddress = dto.cityAddress ?? form.cityAddress;
            form.cityPhone = dto.cityPhone ?? form.cityPhone;
            return await this.formRepository.save(form);
        } else {
            // Create new form
            const newForm = this.formRepository.create({
                userId,
                companyAddress: dto.companyAddress,
                websiteUrl: dto.websiteUrl,
                licenseNumber: dto.licenseNumber,
                mobilePhone: dto.mobilePhone,
                companyPhone: dto.companyPhone,
                propertyAddress: dto.propertyAddress,
                ownerDateStart,
                ownerDateEnd,
                serviceTypes: resolvedServiceTypes ?? [],
                title: dto.title,
                cityOfficial: dto.cityOfficial,
                cityAddress: dto.cityAddress,
                cityPhone: dto.cityPhone,
            });
            return await this.formRepository.save(newForm);
        }
    }

    async validateUniqueFormFields(dto: CreateFormDto, excludeUserId?: string): Promise<void> {
        if (dto.websiteUrl) {
            const existingWebsite = await this.formRepository.findOne({
                where: { websiteUrl: dto.websiteUrl }
            });
            if (existingWebsite && existingWebsite.userId !== excludeUserId) {
                throw new BadRequestException('This website URL is already associated with another account.');
            }
        }

        if (dto.mobilePhone) {
            const existingMobile = await this.formRepository.findOne({
                where: { mobilePhone: dto.mobilePhone }
            });
            if (existingMobile && existingMobile.userId !== excludeUserId) {
                throw new BadRequestException('This mobile phone number is already associated with another account.');
            }
        }

        if (dto.companyPhone) {
            const existingCompanyPhone = await this.formRepository.findOne({
                where: { companyPhone: dto.companyPhone }
            });
            if (existingCompanyPhone && existingCompanyPhone.userId !== excludeUserId) {
                throw new BadRequestException('This company phone number is already associated with another account.');
            }
        }
    }

    async getFormByUserId(userId: string): Promise<UserForm | null> {
        return await this.formRepository.findOne({ where: { userId } });
    }
}
