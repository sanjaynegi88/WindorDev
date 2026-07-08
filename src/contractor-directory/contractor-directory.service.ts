import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ContractorDirectoryProfile } from '../entities/contractor-directory-profile.entity';
import { User, UserRole } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { City } from '../entities/city.entity';
import { ServiceProvided } from '../entities/service-provided.entity';
import { CreateContractorDirectoryProfileDto, UpdateContractorDirectoryProfileDto } from './dto/contractor-directory-profile.dto';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Injectable()
export class ContractorDirectoryService {
    constructor(
        @InjectRepository(ContractorDirectoryProfile)
        private contractorDirectoryRepository: Repository<ContractorDirectoryProfile>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
        @InjectRepository(City)
        private cityRepository: Repository<City>,
        @InjectRepository(ServiceProvided)
        private serviceProvidedRepository: Repository<ServiceProvided>,
    ) {}

    async createProfile(
        userId: string, 
        createDto: CreateContractorDirectoryProfileDto, 
        file?: any
    ): Promise<any> {
        // Check if user is contractor
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user || (user.role !== UserRole.CONTRACTOR && user.role !== UserRole.MANUFACTURER)) {
            throw new ForbiddenException('Only contractors can create directory profiles');
        }

        // Check if profile already exists
        const existingProfile = await this.contractorDirectoryRepository.findOne({
            where: { contractorId: userId }
        });
        if (existingProfile) {
            throw new ConflictException('Directory profile already exists for this contractor');
        }

        // Get contractor's active subscription and membership level
        const membershipLevel = await this.getContractorMembershipLevel(userId);
        if (!membershipLevel) {
            throw new ForbiddenException('Contractor must have SILVER or GOLD membership to create directory profile');
        }

        // Validate city limits based on plan's maxCities
        const plan = await this.getContractorPlan(userId);
        const maxCities = plan?.maxCities ?? (membershipLevel === 'SILVER' ? 5 : 10);
        
        // maxCities = 0 → no access allowed
        if (maxCities === 0) {
            throw new BadRequestException('Your current membership plan does not allow creating contractor directory profile. Please upgrade your plan.');
        }
        
        if (createDto.selected_cities.length > maxCities) {
            throw new BadRequestException(`${membershipLevel} membership allows maximum ${maxCities} cities`);
        }

        // Validate cities exist and get city details
        const cityDetails = await this.validateAndGetCities(createDto.selected_cities);

        // Validate premium-only fields for silver users
        if (membershipLevel === 'SILVER') {
            if (createDto.description || createDto.services_provided_ids || file) {
                throw new BadRequestException('SILVER membership does not allow company logo, description, or services provided');
            }
        }

        // Validate service IDs if provided (PREMIUM only)
        let serviceDetails: Array<{ id: string; service_name: string }> = [];
        if (createDto.services_provided_ids && createDto.services_provided_ids.length > 0) {
            serviceDetails = await this.validateAndGetServices(createDto.services_provided_ids);
        }

        // Handle file upload for gold users
        let companyLogo: string | null = null;
        if (file && membershipLevel === 'GOLD') {
            companyLogo = await this.saveCompanyLogo(userId, file);
        }

        const profile = this.contractorDirectoryRepository.create({
            contractorId: userId,
            companyName: createDto.company_name,
            contactName: createDto.contact_name,
            phone: createDto.phone,
            email: createDto.email,
            websiteUrl: createDto.website_url || null,
            companyLogo,
            description: membershipLevel === 'GOLD' ? createDto.description || null : null,
            servicesProvidedIds: membershipLevel === 'GOLD' ? createDto.services_provided_ids || null : null,
            selectedCities: createDto.selected_cities,
            membershipLevel,
        });

        const savedProfile = await this.contractorDirectoryRepository.save(profile);

        return {
            ...savedProfile,
            services_provided_details: serviceDetails,
            cityDetails,
        };
    }

    async getOwnProfile(userId: string): Promise<any> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user || (user.role !== UserRole.CONTRACTOR && user.role !== UserRole.MANUFACTURER)) {
            throw new ForbiddenException('Only contractors can access directory profiles');
        }

        const profile = await this.contractorDirectoryRepository.findOne({
            where: { contractorId: userId },
            relations: ['contractor']
        });

        if (!profile) {
            throw new NotFoundException('Directory profile not found');
        }

        // Get city details
        const cityDetails = await this.validateAndGetCities(profile.selectedCities);

        // Get service details
        const serviceDetails = profile.servicesProvidedIds && profile.servicesProvidedIds.length > 0
            ? await this.validateAndGetServices(profile.servicesProvidedIds)
            : [];

        const { servicesProvidedIds: _s2, ...profileData } = profile as any;

        return {
            ...profileData,
            services_provided_ids: profile.servicesProvidedIds ?? [],
            services_provided_details: serviceDetails,
            cityDetails,
        };
    }

    async updateProfile(
        userId: string, 
        updateDto: UpdateContractorDirectoryProfileDto, 
        file?: any
    ): Promise<any> {
        const profile = await this.getOwnProfile(userId);
        const membershipLevel = await this.getContractorMembershipLevel(userId);

        if (!membershipLevel) {
            throw new ForbiddenException('Contractor must have SILVER or GOLD membership');
        }

        // Validate city limits if cities are being updated
        let cityDetails: Array<{id: string, name: string}> | null = null;
        if (updateDto.selected_cities) {
            const plan = await this.getContractorPlan(userId);
            const maxCities = plan?.maxCities ?? (membershipLevel === 'SILVER' ? 5 : 10);
            
            // maxCities = 0 → no access allowed
            if (maxCities === 0) {
                throw new BadRequestException('Your current membership plan does not allow maintaining contractor directory profile. Please upgrade your plan.');
            }
            
            if (updateDto.selected_cities.length > maxCities) {
                throw new BadRequestException(`${membershipLevel} membership allows maximum ${maxCities} cities`);
            }
            cityDetails = await this.validateAndGetCities(updateDto.selected_cities);
        }

        // Validate premium-only fields for silver users
        if (membershipLevel === 'SILVER') {
            if (updateDto.description || updateDto.services_provided_ids || file) {
                throw new BadRequestException('SILVER membership does not allow company logo, description, or services provided');
            }
        }

        // Handle file upload for premium users
        if (file && membershipLevel === 'GOLD') {
            profile.companyLogo = await this.saveCompanyLogo(userId, file);
        }

        // Update fields
        if (updateDto.company_name) profile.companyName = updateDto.company_name;
        if (updateDto.contact_name) profile.contactName = updateDto.contact_name;
        if (updateDto.phone) profile.phone = updateDto.phone;
        if (updateDto.email) profile.email = updateDto.email;
        if (updateDto.website_url !== undefined) profile.websiteUrl = updateDto.website_url;
        if (updateDto.selected_cities) profile.selectedCities = updateDto.selected_cities;

        // Gold-only updates
        if (membershipLevel === 'GOLD') {
            if (updateDto.description !== undefined) profile.description = updateDto.description;
            if (updateDto.services_provided_ids !== undefined) {
                profile.servicesProvidedIds = updateDto.services_provided_ids;
            }
        }

        // Update membership level in case it changed
        profile.membershipLevel = membershipLevel;

        const updatedProfile = await this.contractorDirectoryRepository.save(profile);

        // Get city details
        if (!cityDetails && profile.selectedCities) {
            cityDetails = await this.validateAndGetCities(profile.selectedCities);
        }

        // Get service details
        const serviceIds = updatedProfile.servicesProvidedIds;
        const serviceDetails = serviceIds && serviceIds.length > 0
            ? await this.validateAndGetServices(serviceIds)
            : [];

        const { servicesProvidedIds: _s3, ...updatedProfileData } = updatedProfile as any;

        return {
            ...updatedProfileData,
            services_provided_ids: updatedProfile.servicesProvidedIds ?? [],
            services_provided_details: serviceDetails,
            cityDetails,
        };
    }

    async deleteProfile(userId: string): Promise<void> {
        const profile = await this.getOwnProfile(userId);
        await this.contractorDirectoryRepository.remove(profile);
    }

    async adminUpdateProfile(
        profileId: string,
        updateDto: UpdateContractorDirectoryProfileDto,
        file?: any
    ): Promise<any> {
        const profile = await this.contractorDirectoryRepository.findOne({
            where: { id: profileId },
            relations: ['contractor']
        });
        if (!profile) {
            throw new NotFoundException(`Contractor directory profile with ID "${profileId}" not found`);
        }

        // Validate cities if provided
        let cityDetails: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }> | null = null;
        if (updateDto.selected_cities) {
            cityDetails = await this.validateAndGetCities(updateDto.selected_cities);
            profile.selectedCities = updateDto.selected_cities;
        }

        // Validate service IDs if provided
        let serviceDetails: Array<{ id: string; service_name: string }> = [];
        if (updateDto.services_provided_ids !== undefined) {
            if (updateDto.services_provided_ids && updateDto.services_provided_ids.length > 0) {
                serviceDetails = await this.validateAndGetServices(updateDto.services_provided_ids);
            }
            profile.servicesProvidedIds = updateDto.services_provided_ids;
        } else {
            // Keep existing service details
            if (profile.servicesProvidedIds && profile.servicesProvidedIds.length > 0) {
                serviceDetails = await this.validateAndGetServices(profile.servicesProvidedIds);
            }
        }

        // Handle file upload
        if (file) {
            profile.companyLogo = await this.saveCompanyLogo(profile.contractorId, file);
        }

        // Update fields
        if (updateDto.company_name) profile.companyName = updateDto.company_name;
        if (updateDto.contact_name) profile.contactName = updateDto.contact_name;
        if (updateDto.phone) profile.phone = updateDto.phone;
        if (updateDto.email) profile.email = updateDto.email;
        if (updateDto.website_url !== undefined) profile.websiteUrl = updateDto.website_url;
        if (updateDto.description !== undefined) profile.description = updateDto.description;

        const updatedProfile = await this.contractorDirectoryRepository.save(profile);

        if (!cityDetails && profile.selectedCities) {
            cityDetails = await this.validateAndGetCities(profile.selectedCities);
        }

        const { servicesProvidedIds: _s, ...profileData } = updatedProfile as any;

        return {
            ...profileData,
            services_provided_ids: updatedProfile.servicesProvidedIds ?? [],
            services_provided_details: serviceDetails,
            cityDetails,
        };
    }

    async adminDeleteProfile(profileId: string): Promise<void> {
        const profile = await this.contractorDirectoryRepository.findOne({
            where: { id: profileId }
        });
        if (!profile) {
            throw new NotFoundException(`Contractor directory profile with ID "${profileId}" not found`);
        }
        await this.contractorDirectoryRepository.remove(profile);
    }

    async getAllProfiles(profileId?: string, cityId?: string, radius?: number, serviceName?: string, keyword?: string): Promise<any[]> {
        const query = this.contractorDirectoryRepository.createQueryBuilder('profile')
            .leftJoinAndSelect('profile.contractor', 'contractor')
            .where('profile.is_active = :isActive', { isActive: true });

        if (profileId) {
            query.andWhere('profile.id = :profileId', { profileId });
        }

        const profiles = await query.getMany();

        // Add city details and service details to each profile
        const profilesWithCityDetails = await Promise.all(
            profiles.map(async (profile) => {
                const cityDetails = await this.validateAndGetCities(profile.selectedCities);
                const serviceDetails = profile.servicesProvidedIds && profile.servicesProvidedIds.length > 0
                    ? await this.validateAndGetServices(profile.servicesProvidedIds)
                    : [];
                const { servicesProvidedIds: _s4, ...profileData } = profile as any;
                return {
                    ...profileData,
                    services_provided_ids: profile.servicesProvidedIds ?? [],
                    services_provided_details: serviceDetails,
                    cityDetails,
                };
            })
        );

        // Filter by city if provided
        let filteredProfiles = profilesWithCityDetails;
        if (cityId) {
            filteredProfiles = filteredProfiles.filter((profile) =>
                profile.selectedCities && profile.selectedCities.includes(cityId)
            );
        }

        // Filter by service UUID if provided — match against services_provided_ids array
        if (serviceName) {
            filteredProfiles = filteredProfiles.filter((profile) =>
                Array.isArray(profile.services_provided_ids) &&
                profile.services_provided_ids.includes(serviceName)
            );
        }

        // Filter by keyword if provided
        if (keyword) {
            const keywordLower = keyword.toLowerCase();
            filteredProfiles = filteredProfiles.filter((profile) =>
                profile.companyName?.toLowerCase().includes(keywordLower) ||
                profile.contactName?.toLowerCase().includes(keywordLower)
            );
        }

        // Sort profiles: GOLD first (shuffled daily), then SILVER (shuffled daily)
        const sortedProfiles = this.sortProfilesByTierWithDailyRotation(filteredProfiles);

        return sortedProfiles;
    }

    private sortProfilesByTierWithDailyRotation(profiles: any[]): any[] {
        // Separate profiles by membership level
        const goldProfiles = profiles.filter(p => p.membershipLevel === 'GOLD');
        const silverProfiles = profiles.filter(p => p.membershipLevel === 'SILVER');

        // Shuffle each tier with daily seed (changes every 24 hours)
        const shuffledGold = this.shuffleArrayWithDailySeed(goldProfiles, 'GOLD');
        const shuffledSilver = this.shuffleArrayWithDailySeed(silverProfiles, 'SILVER');

        // Return GOLD first, then SILVER
        return [...shuffledGold, ...shuffledSilver];
    }

    private shuffleArrayWithDailySeed<T>(array: T[], tier: string): T[] {
        if (array.length <= 1) return [...array];

        // Create daily seed based on current date + tier
        const today = new Date();
        const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${tier}`;
        const seed = this.hashString(dateString);

        // Shuffle using seeded random
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(this.seededRandom(seed + i) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    private seededRandom(seed: number): number {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    async assertDirectoryAccess(userId: string): Promise<void> {
        const level = await this.getContractorMembershipLevel(userId);
        if (!level) {
            throw new ForbiddenException('Silver or Gold membership is required to access the contractor directory');
        }
    }

    private async getContractorMembershipLevel(userId: string): Promise<'SILVER' | 'GOLD' | null> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });

        if (!subscription || !subscription.plan) return null;

        const plan = subscription.plan;
        // Map legacy and new plan.level values to directory tiers
        const lvl = (plan.level as unknown) as string | undefined;
        if (!lvl) return null;
        if (lvl === 'SILVER' || lvl === 'STANDARD') return 'SILVER';
        if (lvl === 'GOLD' || lvl === 'PREMIUM') return 'GOLD';

        return null;
    }

    private async getContractorPlan(userId: string): Promise<MembershipPlan | null> {
        const subscription = await this.subscriptionRepository.findOne({
            where: { userId, status: 'ACTIVE' },
            relations: ['plan']
        });
        return subscription?.plan || null;
    }

    private async validateAndGetServices(serviceIds: string[]): Promise<Array<{ id: string; service_name: string }>> {
        for (const id of serviceIds) {
            validateUUID(id, 'service id');
        }
        const services = await this.serviceProvidedRepository.find({
            where: { id: In(serviceIds) },
        });
        if (services.length !== serviceIds.length) {
            throw new BadRequestException('One or more services_provided_ids are invalid');
        }
        return services.map(s => ({ id: s.id, service_name: s.service_name }));
    }

    private async validateAndGetCities(cityIds: string[]): Promise<Array<{id: string, name: string, latitude: number | null, longitude: number | null}>> {
        // Validate UUID format for each city ID using existing utility
        for (const cityId of cityIds) {
            validateUUID(cityId, 'city id');
        }
        
        const cities = await this.cityRepository.findByIds(cityIds);
        if (cities.length !== cityIds.length) {
            throw new BadRequestException('One or more selected cities are invalid');
        }
        return cities.map(city => ({
            id: city.id,
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude
        }));
    }

    private async validateCities(cityIds: string[]): Promise<void> {
        // Validate UUID format for each city ID using existing utility
        for (const cityId of cityIds) {
            validateUUID(cityId, 'city id');
        }
        
        const cities = await this.cityRepository.findByIds(cityIds);
        if (cities.length !== cityIds.length) {
            throw new BadRequestException('One or more selected cities are invalid');
        }
    }

    private async saveCompanyLogo(userId: string, file: any): Promise<string> {
        const fs = require('fs');
        const path = require('path');
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads', 'company-logos');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = path.extname(file.originalname);
        const filename = `${userId}_${timestamp}${fileExtension}`;
        const filePath = path.join(uploadsDir, filename);
        
        // Save file to disk
        fs.writeFileSync(filePath, file.buffer);
        
        // Return the URL path
        return `/uploads/company-logos/${filename}`;
    }
}