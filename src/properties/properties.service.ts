import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { ReportPurchase } from '../entities/report-purchase.entity';
import { UserReportUsage } from '../entities/user-report-usage.entity';
import { Property } from '../entities/property.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { UserRole } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { PropertyComment } from '../entities/property-comment.entity';
import { ProjectPermit } from '../entities/project-permit.entity';
import { ReportImage } from '../entities/report-image.entity';
import { UserProfile } from '../entities/user-profile.entity';


@Injectable()
export class PropertiesService {
    constructor(
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>,
        @InjectRepository(PropertyProject)
        private propertyProjectRepository: Repository<PropertyProject>,
        @InjectRepository(Roofing)
        private roofingRepository: Repository<Roofing>,
        @InjectRepository(Siding)
        private sidingRepository: Repository<Siding>,
        @InjectRepository(Windows)
        private windowsRepository: Repository<Windows>,
        @InjectRepository(Doors)
        private doorsRepository: Repository<Doors>,
        @InjectRepository(GarageDoors)
        private garageDoorsRepository: Repository<GarageDoors>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(ReportPurchase)
        private reportPurchaseRepository: Repository<ReportPurchase>,
        @InjectRepository(UserReportUsage)
        private userReportUsageRepository: Repository<UserReportUsage>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(OwnerProject)
        private ownerProjectRepository: Repository<OwnerProject>,
        @InjectRepository(PropertyComment)
        private propertyCommentRepository: Repository<PropertyComment>,
        @InjectRepository(ProjectPermit)
        private projectPermitRepository: Repository<ProjectPermit>,
        @InjectRepository(ReportImage)
        private reportImageRepository: Repository<ReportImage>,
        @InjectRepository(UserProfile)
        private userProfileRepository: Repository<UserProfile>,
    ) {}

    /**
     * Batch-resolve contractor IDs to company_name from user_profiles.
     * Returns a Map<contractor_id, company_name>.
     */
    private async resolveContractorCompanyNames(contractorIds: (string | null | undefined)[]): Promise<Map<string, string>> {
        const uniqueIds = [...new Set(contractorIds.filter((id): id is string => !!id))];
        const map = new Map<string, string>();
        if (uniqueIds.length === 0) return map;

        const profiles = await this.userProfileRepository.find({
            where: { user_id: In(uniqueIds) },
            select: ['user_id', 'company_name'],
        });

        profiles.forEach(profile => {
            if (profile.company_name) {
                map.set(profile.user_id, profile.company_name);
            }
        });

        return map;
    }

    async getComponentSummaries(
        userId: string,
        userRole: string,
        propertyId?: string,
        brandName?: string,
        style?: string,
        color?: string,
        search?: string,
        hasReport?: boolean,
        propertyType?: string,
        zip?: string,
        page?: number,
        limit?: number,
        stateId?: string,
        cityId?: string,
        isPurchased?: boolean,
        ownerEmail?: string
    ): Promise<{ data: any[], total: number }> {
        // Resolve user IDs to check based on role
        let userIdsToCheck: string[] = [userId];
        const requestingUser = await this.userRepository.findOne({ where: { id: userId } });
        if (requestingUser && requestingUser.role === UserRole.INSURANCE_COMPANY) {
            const companyOwnerId = requestingUser.sub_account ? requestingUser.parent_id : requestingUser.id;
            const members = await this.userRepository.find({
                where: [{ id: companyOwnerId }, { parent_id: companyOwnerId }],
                select: ['id']
            });
            userIdsToCheck = members.map(m => m.id);
        }

        // Fetch purchased and accessed property IDs
        const purchases = await this.reportPurchaseRepository.find({
            where: { purchasedByUserId: In(userIdsToCheck) },
            select: ['propertyId', 'purchaseType', 'metadata', 'paymentIntentId']
        });
        
        // Handle different purchase types and check Stripe metadata
        const purchasedIds: string[] = [];
        let bulkCreditsRemaining = 0;
        
        purchases.forEach(purchase => {
            if (purchase.purchaseType === 'one_time' && purchase.propertyId) {
                // Direct property purchase - check if it has valid Stripe metadata
                const hasStripeMetadata = purchase.metadata?.stripeSessionId || purchase.paymentIntentId;
                if (hasStripeMetadata) {
                    purchasedIds.push(purchase.propertyId);
                }
            } else if (purchase.purchaseType === 'bulk' || purchase.purchaseType === 'credits') {
                // Bulk purchase - check Stripe metadata and remaining credits
                const hasStripeMetadata = purchase.metadata?.stripeSessionId || purchase.paymentIntentId;
                if (hasStripeMetadata) {
                    const credits = purchase.metadata?.credits_remaining || purchase.metadata?.total_credits || 0;
                    bulkCreditsRemaining += credits;
                }
            }
        });

        const usages = await this.userReportUsageRepository.find({
            where: { userId: In(userIdsToCheck) },
            select: ['reportId', 'paymentIntentId', 'isFree']
        });
        
        // Only include usage records that have valid payment or are free via subscription
        const validUsedIds = usages
            .filter(usage => usage.paymentIntentId || usage.isFree)
            .map(u => u.reportId)
            .filter((id): id is string => !!id);

        const directlyUnlockedIds = new Set<string>([...purchasedIds, ...validUsedIds]);

        const query = this.propertyRepository.createQueryBuilder('property')
            .leftJoinAndSelect('property.city', 'city')
            .leftJoinAndSelect('property.state', 'state')
            .leftJoinAndSelect('property.property_type', 'property_type')
            .leftJoinAndSelect('property.property_owner', 'property_owner')
            .leftJoinAndSelect('property.creator', 'creator')
            .leftJoinAndSelect('property.contractor', 'contractor')
            .leftJoinAndSelect('property.projects', 'project')
            .leftJoinAndSelect('project.contractor', 'project_contractor')
            .leftJoinAndSelect('project.createdBy', 'project_created_by');

        // Apply filters
        if (propertyId) {
            query.andWhere('property.id = :propertyId', { propertyId });
        }

        if (hasReport !== undefined) {
            query.andWhere('property.has_report = :hasReport', { hasReport });
        }

        if (isPurchased !== undefined) {
            if (isPurchased) {
                if (directlyUnlockedIds.size === 0) {
                    query.andWhere('1 = 0');
                } else {
                    query.andWhere('property.id IN (:...unlockedIds)', { unlockedIds: Array.from(directlyUnlockedIds) });
                }
            } else {
                if (directlyUnlockedIds.size > 0) {
                    query.andWhere('property.id NOT IN (:...unlockedIds)', { unlockedIds: Array.from(directlyUnlockedIds) });
                }
            }
        }

        if (search) {
            // Enhanced search: search in property fields AND component fields
            query.leftJoin('roofing', 'search_roofing', 'search_roofing.property_id = property.id AND search_roofing.is_latest = true')
                 .leftJoin('siding', 'search_siding', 'search_siding.property_id = property.id AND search_siding.is_latest = true')
                 .leftJoin('windows', 'search_windows', 'search_windows.property_id = property.id AND search_windows.is_latest = true')
                 .leftJoin('doors', 'search_doors', 'search_doors.property_id = property.id AND search_doors.is_latest = true')
                 .leftJoin('garage_doors', 'search_garage_doors', 'search_garage_doors.property_id = property.id AND search_garage_doors.is_latest = true')
                 .andWhere(`(
                    property.address ILIKE :search OR property.address2 ILIKE :search OR 
                    property.property_name ILIKE :search OR 
                    property.parcel_id ILIKE :search OR
                    city.name ILIKE :search OR
                    state.state_name ILIKE :search OR
                    property_type.type_name ILIKE :search OR
                    search_roofing.brand ILIKE :search OR
                    search_roofing.style ILIKE :search OR
                    search_roofing.color ILIKE :search OR
                    search_roofing.material ILIKE :search OR
                    search_roofing.supplier ILIKE :search OR
                    search_roofing.installer ILIKE :search OR
                    search_siding.brand ILIKE :search OR
                    search_siding.style ILIKE :search OR
                    search_siding.color ILIKE :search OR
                    search_siding.material ILIKE :search OR
                    search_siding.supplier ILIKE :search OR
                    search_siding.installer ILIKE :search OR
                    search_windows.brand ILIKE :search OR
                    search_windows.production_line ILIKE :search OR
                    search_windows.supplier ILIKE :search OR
                    search_windows.installer ILIKE :search OR
                    search_doors.brand ILIKE :search OR
                    search_doors.production_line ILIKE :search OR
                    search_doors.supplier ILIKE :search OR
                    search_doors.installer ILIKE :search OR
                    search_garage_doors.brand ILIKE :search OR
                    search_garage_doors.supplier ILIKE :search OR
                    search_garage_doors.installer ILIKE :search
                 )`, { search: `%${search}%` });
        }

        if (ownerEmail) {
            query.andWhere('property_owner.email = :ownerEmail', { ownerEmail });
        }

        if (zip) {
            query.andWhere('property.zip = :zip', { zip });
        }

        if (stateId) {
            query.andWhere('property.state_id = :stateId', { stateId });
        }

        if (cityId) {
            query.andWhere('property.city_id = :cityId', { cityId });
        }

        if (propertyType) {
            query.andWhere('property.property_type_id = :propertyType', { propertyType });
        }

        // Component-based filters - need to join first, then filter
        if (brandName || style || color) {
            query.leftJoin('roofing', 'roofing', 'roofing.property_id = property.id AND roofing.is_latest = true')
                 .leftJoin('siding', 'siding', 'siding.property_id = property.id AND siding.is_latest = true')
                 .leftJoin('windows', 'windows', 'windows.property_id = property.id AND windows.is_latest = true')
                 .leftJoin('doors', 'doors', 'doors.property_id = property.id AND doors.is_latest = true')
                 .leftJoin('garage_doors', 'garage_doors', 'garage_doors.property_id = property.id AND garage_doors.is_latest = true');

            const componentConditions: string[] = [];
            if (brandName) {
                componentConditions.push('(roofing.brand ILIKE :brandName OR siding.brand ILIKE :brandName OR windows.brand ILIKE :brandName OR doors.brand ILIKE :brandName OR garage_doors.brand ILIKE :brandName)');
                query.setParameter('brandName', `%${brandName}%`);
            }
            if (style) {
                componentConditions.push('(roofing.style ILIKE :style OR siding.style ILIKE :style)');
                query.setParameter('style', `%${style}%`);
            }
            if (color) {
                componentConditions.push('(roofing.color ILIKE :color OR siding.color ILIKE :color)');
                query.setParameter('color', `%${color}%`);
            }

            if (componentConditions.length > 0) {
                query.andWhere(`(${componentConditions.join(' OR ')})`);
            }
        }

        // Only include properties associated with a report creator for all roles
        query.andWhere('property.created_by IS NOT NULL');

        // Role-based filtering
        if (userRole === UserRole.ADMIN) {
            // Admin sees everything — public and private, with or without report
        } else if (userRole === UserRole.CITY_INSPECTOR) {
            // City inspector: public, report-generated, in their city only
            const inspector = await this.userRepository.findOne({ where: { id: userId } });
            if (inspector && inspector.city_id) {
                query.andWhere('property.city_id = :inspectorCityId', { inspectorCityId: inspector.city_id })
                     .andWhere('property.has_report = true')
                     .andWhere('project.visible_status = :publicStatus', { publicStatus: 'public' })
                     .andWhere('project.project_status = :completeStatus', { completeStatus: 'COMPLETE' });
            } else {
                query.andWhere('1 = 0');
            }
        } else if (userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) {
            // Contractor / Manufacturer: own properties, OR contractor on any project, OR others' public+complete projects
            query.andWhere('(property.created_by = :userId OR property.contractor_id = :userId OR project.contractor_id = :userId OR project.id IS NULL OR (project.visible_status = :publicStatus AND project.project_status = :completeStatus))', { userId, publicStatus: 'public', completeStatus: 'COMPLETE' })
                 .andWhere('property.created_by IS NOT NULL');
        } else if (userRole === UserRole.INSURANCE_COMPANY) {
            // Insurance company: public + complete + report-generated only
            query.andWhere('property.has_report = true')
                 .andWhere('project.visible_status = :publicStatus', { publicStatus: 'public' })
                 .andWhere('project.project_status = :completeStatus', { completeStatus: 'COMPLETE' });
        } else if (userRole === UserRole.PROPERTY_OWNER) {
            // Property owner: own properties (public + private + draft) + others' public+complete report-generated
            query.andWhere(
                '(property.property_owner_id = :userId OR (property.has_report = true AND project.visible_status = :publicStatus AND project.project_status = :completeStatus))',
                { userId, publicStatus: 'public', completeStatus: 'COMPLETE' }
            );
        } else {
            // Any other role: public + complete only
            query.andWhere('project.visible_status = :publicStatus', { publicStatus: 'public' })
                 .andWhere('project.project_status = :completeStatus', { completeStatus: 'COMPLETE' });
        }

        query.distinct(true);

        // Order by created_at DESC for consistent top results
        query.orderBy('property.created_at', 'DESC');

        // Get total count
        const total = await query.getCount();

        // Apply pagination only if provided
        if (page && limit) {
            query.skip((page - 1) * limit).take(limit);
        } else if (limit) {
            query.take(limit);
        }

        const properties = await query.getMany();

        if (properties.length === 0) {
            return { data: [], total: 0 };
        }

        // Get all property IDs for batch queries
        const propertyIds = properties.map(p => p.id);

        // Collect all project IDs across all properties
        const allProjectIds = properties.flatMap(p => (p.projects || []).map((proj: any) => proj.id));

        // Batch fetch all components to avoid N+1 queries (projects now come from relationship)
        const [allRoofing, allSiding, allWindows, allDoors, allGarageDoors] = await Promise.all([
            this.roofingRepository.find({
                where: { property_id: In(propertyIds), isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.sidingRepository.find({
                where: { property_id: In(propertyIds), isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.windowsRepository.find({
                where: { property_id: In(propertyIds), isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.doorsRepository.find({
                where: { property_id: In(propertyIds), isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.garageDoorsRepository.find({
                where: { property_id: In(propertyIds), isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            })
        ]);

        const allComponentIds = [
            ...allRoofing.map(r => r.id),
            ...allSiding.map(s => s.id),
            ...allWindows.map(w => w.id),
            ...allDoors.map(d => d.id),
            ...allGarageDoors.map(g => g.id)
        ].filter((id): id is string => !!id);

        const componentImages = allComponentIds.length > 0
            ? await this.reportImageRepository.find({
                where: { component_id: In(allComponentIds) },
                order: { created_at: 'ASC' }
            })
            : [];

        const imagesByComponentId = new Map<string, any[]>();
        const ownerImagesByComponentId = new Map<string, any>();
        const ownerUploadedByComponentId = new Map<string, boolean>();
        componentImages.forEach(image => {
            if (!imagesByComponentId.has(image.component_id)) {
                imagesByComponentId.set(image.component_id, []);
            }
            if (!ownerImagesByComponentId.has(image.component_id)) {
                ownerImagesByComponentId.set(image.component_id, {});
            }
            if (!ownerUploadedByComponentId.has(image.component_id)) {
                ownerUploadedByComponentId.set(image.component_id, false);
            }
            
            const contractorImages = imagesByComponentId.get(image.component_id);
            
            if (image.owner_uploaded) {
                // Owner uploaded images - store as object with only property_owner_files
                const ownerImageData = {
                    property_owner_files: image.property_owner_files
                };
                ownerImagesByComponentId.set(image.component_id, ownerImageData);
                ownerUploadedByComponentId.set(image.component_id, true);
            } else {
                // Contractor uploaded images - exclude property_owner_files and owner_uploaded
                if (contractorImages) {
                    const { property_owner_files, owner_uploaded, ...sanitizedImage } = image;
                    contractorImages.push(sanitizedImage);
                }
            }
        });

        // Batch fetch owner_projects and permits for all project IDs
        // owner_projects.project_id → PropertyProject.id
        // project_permits.project_id → OwnerProject.id
        const allOwnerProjects: OwnerProject[] = allProjectIds.length > 0
            ? await this.ownerProjectRepository.find({
                where: { project_id: In(allProjectIds) },
                relations: ['brandEntity'],
            })
            : [];

        // Now fetch permits using the PropertyProject IDs (since we migrated project_permits.project_id to point to property_project)
        const permits: ProjectPermit[] = allProjectIds.length > 0
            ? await this.projectPermitRepository.find({
                where: { project_id: In(allProjectIds) },
                select: [
                    'id',
                    'project_id',
                    'status',
                    'uploaded_by',
                    'uploader_role',
                    'file_path',
                    'notes',
                    'verified_by',
                    'verified_at',
                    'uploaded_at'
                ],
                order: { created_at: 'DESC' },
            })
            : [];

        // Map: PropertyProject.id → OwnerProject
        const ownerProjectByProjectId = new Map<string, OwnerProject>();
        (allOwnerProjects as OwnerProject[]).forEach((op: OwnerProject) => {
            ownerProjectByProjectId.set(op.project_id, op);
        });

        // Map: PropertyProject.id → first permit (most recent)
        const permitByProjectId = new Map<string, ProjectPermit>();
        permits.forEach((permit: ProjectPermit) => {
            if (!permitByProjectId.has(permit.project_id)) {
                permitByProjectId.set(permit.project_id, permit);
            }
        });

        // Map: PropertyProject.id → set of project_ids that have component data
        // For contractor types: check roofing/siding/windows/doors/garage_doors tables
        const contractorTypes = new Set(['ROOFING', 'SIDING', 'WINDOWS', 'DOORS', 'GARAGE_DOORS', 'WINDOW_DOOR']);
        const projectIdsWithRoofing = new Set(allRoofing.map(r => r.project_id).filter(Boolean));
        const projectIdsWithSiding = new Set(allSiding.map(s => s.project_id).filter(Boolean));
        const projectIdsWithWindows = new Set(allWindows.map(w => w.project_id).filter(Boolean));
        const projectIdsWithDoors = new Set(allDoors.map(d => d.project_id).filter(Boolean));
        const projectIdsWithGarageDoors = new Set(allGarageDoors.map(g => g.project_id).filter(Boolean));
        // For owner types: check owner_projects table (has a record = details filled)
        const projectIdsWithOwnerDetails = new Set(
            (allOwnerProjects as OwnerProject[]).map((op: OwnerProject) => op.project_id)
        );

        // Group by property_id for efficient lookup (no need for projects since they come from relationship)
        const roofingByProperty = new Map();
        const sidingByProperty = new Map();
        const windowsByProperty = new Map();
        const doorsByProperty = new Map();
        const garageDoorsbyProperty = new Map();

        allRoofing.forEach(roofing => {
            if (!roofingByProperty.has(roofing.property_id)) {
                roofingByProperty.set(roofing.property_id, []);
            }
            roofingByProperty.get(roofing.property_id).push(roofing);
        });

        allSiding.forEach(siding => {
            if (!sidingByProperty.has(siding.property_id)) {
                sidingByProperty.set(siding.property_id, []);
            }
            sidingByProperty.get(siding.property_id).push(siding);
        });

        allWindows.forEach(windows => {
            if (!windowsByProperty.has(windows.property_id)) {
                windowsByProperty.set(windows.property_id, []);
            }
            windowsByProperty.get(windows.property_id).push(windows);
        });

        allDoors.forEach(doors => {
            if (!doorsByProperty.has(doors.property_id)) {
                doorsByProperty.set(doors.property_id, []);
            }
            doorsByProperty.get(doors.property_id).push(doors);
        });

        allGarageDoors.forEach(garageDoors => {
            if (!garageDoorsbyProperty.has(garageDoors.property_id)) {
                garageDoorsbyProperty.set(garageDoors.property_id, []);
            }
            garageDoorsbyProperty.get(garageDoors.property_id).push(garageDoors);
        });

        // Batch-resolve contractor IDs → company_name for all components
        const allContractorIds = [
            ...allRoofing.map(r => (r as any).contractor_id),
            ...allSiding.map(s => (s as any).contractor_id),
            ...allWindows.map(w => (w as any).contractor_id),
            ...allDoors.map(d => (d as any).contractor_id),
            ...allGarageDoors.map(g => (g as any).contractor_id),
        ];
        const contractorCompanyMap = await this.resolveContractorCompanyNames(allContractorIds);

        // Helper to shape a user object to only essential fields
        const formatUser = (user: any) => user ? {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        } : null;

        // Helper to shape a project object, trimming nested user objects
        const formatProject = (project: any, propertyComponents: any[] = []) => {
            if (!project) return project;

            const projectType: string = project.project_type || '';
            const projectId: string = project.id;

            // Get permit details from permitByProjectId (includes status)
            const permit = permitByProjectId.get(projectId);
            const permitData = permit ? {
                id: permit.id,
                status: permit.status,
                uploaded_by: permit.uploaded_by,
                uploader_role: permit.uploader_role,
                file_path: permit.file_path,
                notes: permit.notes,
                verified_by: permit.verified_by,
                verified_at: permit.verified_at,
                uploaded_at: permit.uploaded_at,
            } : null;

            const ownerProject = ownerProjectByProjectId.get(projectId);

            // For owner-type projects, embed the full owner_projects details record (null for contractor types)
            let componentData = propertyComponents.find(c => c.project_id === projectId) || null;
            if (!componentData && !contractorTypes.has(projectType) && ownerProject) {
                const { brandEntity, brand_id, ...ownerProjectRest } = ownerProject as any;
                componentData = { ...ownerProjectRest, component_type: projectType };
            }

            const componentWithImages = componentData
                ? { 
                    ...componentData, 
                    images: imagesByComponentId.get(componentData.id) || [],
                    owner_images: ownerImagesByComponentId.get(componentData.id) || {},
                    owner_uploaded: ownerUploadedByComponentId.get(componentData.id) || false
                }
                : componentData;

            return {
                ...project,
                contractor: formatUser(project.contractor),
                createdBy: formatUser(project.createdBy),
                permit: project.permit,
                permit_upload: permitData,
                components: componentWithImages,
            };
        };

        // Build enhanced properties
        const enhancedProperties = properties.map((property, index) => {
            // Projects are now directly available from the relationship
            let projects = property.projects || [];
            
            // City inspector can now see projects without permit_upload

            // General visibility filtering for all roles (except Admin)
            if (userRole !== UserRole.ADMIN) {
                const isCreator = property.created_by === userId;
                const isOwner = property.property_owner_id === userId;
                const isPropertyContractor = property.contractor_id === userId;
                // Also check if user is contractor on any individual project
                const isProjectContractor = projects.some(p => p.contractor_id === userId);
                if (!isCreator && !isOwner && !isPropertyContractor && !isProjectContractor) {
                    // Only show PUBLIC and COMPLETE projects to others
                    projects = projects.filter(p => p.visible_status === 'public' && p.project_status === 'COMPLETE');
                } else if (!isCreator && !isOwner && !isPropertyContractor && isProjectContractor) {
                    // Show all projects they are contractor on, plus public+complete others
                    projects = projects.filter(p => p.contractor_id === userId || (p.visible_status === 'public' && p.project_status === 'COMPLETE'));
                }
            }

            const validProjectIds = new Set(projects.map(p => p.id));

            // For the summary PDF, once a property is accessible, show ALL its latest components
            // regardless of project visibility status. Project visibility only controls which
            // properties appear — not which component data shows within an accessible property.
            const filterValidComponents = (components: any[]) => components;

            const roofing = filterValidComponents(roofingByProperty.get(property.id) || []);
            const siding = filterValidComponents(sidingByProperty.get(property.id) || []);
            const windows = filterValidComponents(windowsByProperty.get(property.id) || []);
            const doors = filterValidComponents(doorsByProperty.get(property.id) || []);
            const garageDoors = filterValidComponents(garageDoorsbyProperty.get(property.id) || []);

            // Check if property is purchased
            let isPurchased = directlyUnlockedIds.has(property.id);
            
            // If not directly purchased, check if user has bulk credits remaining
            if (!isPurchased && bulkCreditsRemaining > 0) {
                // For bulk credits, we can consider properties as "purchasable" but not yet "purchased"
                // You might want to implement logic here based on your business rules
                // For example: first N properties are considered purchased if user has credits
                isPurchased = index < bulkCreditsRemaining;
            }

            // Format components for PDF service compatibility
            const components = [
                ...roofing.map(r => { 
                    const { brand_id, ...rest } = r; 
                    return { 
                        ...rest, 
                        component_type: 'ROOFING',
                        contractor_company_name: contractorCompanyMap.get((r as any).contractor_id) || '',
                        images: imagesByComponentId.get(r.id) || [],
                        owner_images: ownerImagesByComponentId.get(r.id) || {},
                        owner_uploaded: ownerUploadedByComponentId.get(r.id) || false
                    }; 
                }),
                ...siding.map(s => { 
                    const { brand_id, ...rest } = s; 
                    return { 
                        ...rest, 
                        component_type: 'SIDING',
                        contractor_company_name: contractorCompanyMap.get((s as any).contractor_id) || '',
                        images: imagesByComponentId.get(s.id) || [],
                        owner_images: ownerImagesByComponentId.get(s.id) || {},
                        owner_uploaded: ownerUploadedByComponentId.get(s.id) || false
                    }; 
                }),
                ...windows.map(w => { 
                    const { brand_id, ...rest } = w; 
                    return { 
                        ...rest, 
                        component_type: 'WINDOWS',
                        contractor_company_name: contractorCompanyMap.get((w as any).contractor_id) || '',
                        images: imagesByComponentId.get(w.id) || [],
                        owner_images: ownerImagesByComponentId.get(w.id) || {},
                        owner_uploaded: ownerUploadedByComponentId.get(w.id) || false
                    }; 
                }),
                ...doors.map(d => { 
                    const { brand_id, ...rest } = d; 
                    return { 
                        ...rest, 
                        component_type: 'DOORS',
                        contractor_company_name: contractorCompanyMap.get((d as any).contractor_id) || '',
                        images: imagesByComponentId.get(d.id) || [],
                        owner_images: ownerImagesByComponentId.get(d.id) || {},
                        owner_uploaded: ownerUploadedByComponentId.get(d.id) || false
                    }; 
                }),
                ...garageDoors.map(g => { 
                    const { brand_id, ...rest } = g; 
                    return { 
                        ...rest, 
                        component_type: 'GARAGE_DOORS',
                        contractor_company_name: contractorCompanyMap.get((g as any).contractor_id) || '',
                        images: imagesByComponentId.get(g.id) || [],
                        owner_images: ownerImagesByComponentId.get(g.id) || {},
                        owner_uploaded: ownerUploadedByComponentId.get(g.id) || false
                    }; 
                })
            ];

            // Get visible_status from the first project (assuming all projects for a property have same visibility)
            const visible_status = projects.length > 0 ? projects[0].visible_status : 'public';

            // Destructure out the full city/state objects — we already have city_id, city_name, state_id, state_name as flat fields
            const { city, state, ...propertyWithoutCityState } = property as any;

            // Determine if creator is owner or contractor
            let createdByType: string | null = null;
            if (property.creator) {
                if (property.creator.role === UserRole.CONTRACTOR) {
                    createdByType = 'CONTRACTOR';
                } else if (property.creator.role === UserRole.PROPERTY_OWNER) {
                    createdByType = 'PROPERTY_OWNER';
                } else if (property.created_by === property.property_owner_id) {
                    createdByType = 'PROPERTY_OWNER';
                } else if (property.created_by === property.contractor_id) {
                    createdByType = 'CONTRACTOR';
                }
            }

            return {
                ...propertyWithoutCityState,
                // Shape property_type to only id + type_name
                property_type: property.property_type ? {
                    id: property.property_type.id,
                    type_name: (property.property_type as any).type_name
                } : null,
                // Shape user relations to only essential fields
                property_owner: formatUser(property.property_owner),
                creator: formatUser(property.creator),
                contractor: formatUser(property.contractor),
                visible_status,
                is_purchased: isPurchased,
                created_by_type: createdByType,
                projects: projects.map((p) => formatProject(p, components)),
                components,
            };
        });

        return { data: enhancedProperties, total };
    }

    async getPropertyWithComponentsForPDF(
        propertyId: string,
        userId: string,
        userRole: string,
        projectType?: string
    ): Promise<any> {
        const query = this.propertyRepository.createQueryBuilder('property')
            .leftJoinAndSelect('property.city', 'city')
            .leftJoinAndSelect('property.state', 'state')
            .leftJoinAndSelect('property.property_type', 'property_type')
            .leftJoinAndSelect('property.property_owner', 'property_owner')
            .leftJoinAndSelect('property.creator', 'creator')
            .leftJoinAndSelect('property.contractor', 'contractor')
            .where('property.id = :propertyId', { propertyId });

        const property = await query.getOne();

        if (!property) {
            return {};
        }

        const normalizedProjectType =
            projectType && projectType !== 'ANY' ? projectType : undefined;

        // Fetch projects — if project_type filter provided, only return matching projects
        const projectWhere: any = { property_id: property.id };
        if (normalizedProjectType) {
            projectWhere.project_type = normalizedProjectType;
        }

        const projects = await this.propertyProjectRepository.find({
            where: projectWhere,
            relations: ['contractor', 'createdBy'],
            order: { created_at: 'DESC' },
        });

        // Filter out private or draft projects unless the user is the creator, owner, or admin
        let publicProjects = projects.filter((project) => {
            if (userRole === 'ADMIN') return true;
            
            const isCreator = property.created_by === userId;
            const isOwner = property.property_owner_id === userId;
            const isContractor = project.contractor_id === userId;
            
            if (isCreator || isOwner || isContractor) return true;
            
            return project.visible_status === 'public' && project.project_status === 'COMPLETE';
        });

        // Fetch permits for all projects (optional — do not exclude projects without permits in PDF)
        const projectIds = publicProjects.map((p) => p.id);
        const permits: ProjectPermit[] =
            projectIds.length > 0
                ? await this.projectPermitRepository.find({
                      where: { project_id: In(projectIds) },
                      order: { uploaded_at: 'DESC' },
                  })
                : [];

        const permitByProjectId = new Map<string, ProjectPermit>();
        permits.forEach((permit: ProjectPermit) => {
            if (!permitByProjectId.has(permit.project_id)) {
                permitByProjectId.set(permit.project_id, permit);
            }
        });

        publicProjects = publicProjects.map((project) => {
            const permit = permitByProjectId.get(project.id);
            return {
                ...project,
                permit_status: permit?.status ?? null,
                permit_upload: permit
                    ? {
                          id: permit.id,
                          status: permit.status,
                          file_path: permit.file_path,
                          notes: permit.notes,
                          uploaded_at: permit.uploaded_at,
                      }
                    : null,
            };
        });

        const matchingProjectIds = new Set(publicProjects.map((p) => p.id));

        // Fetch all latest components for this property, then filter by project
        const [allRoofing, allSiding, allWindows, allDoors, allGarageDoors, allOwnerProjects] = await Promise.all([
            this.roofingRepository.find({
                where: { property_id: property.id, isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.sidingRepository.find({
                where: { property_id: property.id, isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.windowsRepository.find({
                where: { property_id: property.id, isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.doorsRepository.find({
                where: { property_id: property.id, isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.garageDoorsRepository.find({
                where: { property_id: property.id, isLatest: true },
                relations: ['report'],
                order: { created_at: 'DESC' }
            }),
            this.ownerProjectRepository.find({
                where: { property_id: property.id },
                relations: ['brandEntity'],
            })
        ]);

        const allComponentIds = [
            ...allRoofing.map((r) => r.id),
            ...allSiding.map((s) => s.id),
            ...allWindows.map((w) => w.id),
            ...allDoors.map((d) => d.id),
            ...allGarageDoors.map((g) => g.id),
            ...allOwnerProjects.map((op) => op.id),
        ].filter((id): id is string => !!id);

        const componentImages =
            allComponentIds.length > 0
                ? await this.reportImageRepository.find({
                      where: [
                          { component_id: In(allComponentIds) },
                          { owner_project_id: In(allOwnerProjects.map(op => op.id).filter(id => !!id)) }
                      ],
                      order: { created_at: 'ASC' },
                  })
                : [];

        const imagesByComponentId = new Map<string, any[]>();
        componentImages.forEach((image) => {
            const compId = image.component_id || image.owner_project_id;
            if (compId) {
                if (!imagesByComponentId.has(compId)) {
                    imagesByComponentId.set(compId, []);
                }
                // Exclude property_owner_files and owner_uploaded from response
                const { property_owner_files, owner_uploaded, ...sanitizedImage } = image;
                imagesByComponentId.get(compId)!.push(sanitizedImage);
            }
        });

        // Batch-resolve contractor IDs → company_name for all components
        const allPdfContractorIds = [
            ...allRoofing.map(r => (r as any).contractor_id),
            ...allSiding.map(s => (s as any).contractor_id),
            ...allWindows.map(w => (w as any).contractor_id),
            ...allDoors.map(d => (d as any).contractor_id),
            ...allGarageDoors.map(g => (g as any).contractor_id),
        ];
        const contractorCompanyMap = await this.resolveContractorCompanyNames(allPdfContractorIds);

        const attachImages = (items: any[], componentType: string | ((item: any) => string)) =>
            items.map((item) => ({
                ...item,
                component_type: typeof componentType === 'function' ? componentType(item) : componentType,
                contractor_company_name: contractorCompanyMap.get(item.contractor_id) || '',
                images: imagesByComponentId.get(item.id) || [],
            }));

        // When project_type is specified, only include components whose project_id
        // belongs to a project of that type. When no filter, include all.
        const filterByProject = (items: any[]) =>
            normalizedProjectType
                ? items.filter((item) => item.project_id && matchingProjectIds.has(item.project_id))
                : items;

        const ownerProjectsMapped = allOwnerProjects.map(op => {
            // Determine project type from the associated property project
            const associatedProject = publicProjects.find(p => p.id === op.project_id);
            return {
                ...op,
                component_type: associatedProject ? associatedProject.project_type : 'OTHER'
            };
        });

        const components = [
            ...filterByProject(attachImages(allRoofing, 'ROOFING')),
            ...filterByProject(attachImages(allSiding, 'SIDING')),
            ...filterByProject(attachImages(allWindows, 'WINDOWS')),
            ...filterByProject(attachImages(allDoors, 'DOORS')),
            ...filterByProject(attachImages(allGarageDoors, 'GARAGE_DOORS')),
            ...filterByProject(attachImages(ownerProjectsMapped, (item) => item.component_type)),
        ];

        return {
            ...property,
            projects: publicProjects,
            components,
        };
    }

    async checkComponentExists(propertyId: string, projectType: string): Promise<boolean> {
        try {
            // Check if any project with the given project_type exists for this property
            const project = await this.propertyProjectRepository.findOne({
                where: { property_id: propertyId, project_type: projectType as any }
            });
            return !!project;
        } catch (error) {
            console.error('Error checking project_type existence:', error);
            return false;
        }
    }

    async create(createPropertyDto: any, userId: string, userRole: string, userCityId?: string | null): Promise<any> {
        // Validate required UUIDs exist in database
        if (createPropertyDto.city_id) {
            const cityExists = await this.propertyRepository.manager.findOne('cities', { where: { id: createPropertyDto.city_id } }) as any;
            if (!cityExists) {
                throw new BadRequestException('City not found');
            }

            const requestedZip = String(createPropertyDto.zip ?? '').trim();
            const cityZipCodes = Array.isArray(cityExists.zip_codes)
                ? cityExists.zip_codes.map((zip: any) => String(zip).trim())
                : [];

            if (!cityZipCodes.includes(requestedZip)) {
                throw new BadRequestException(`The ZIP code ${requestedZip} is not valid for the selected city.`);
            }
        }

        // CONTRACTOR/MANUFACTURER: city_id is required by DTO but may be any valid city
        if (userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) {
            if (!createPropertyDto.city_id) {
                throw new BadRequestException('city_id is required when creating a property');
            }
        }
        
        if (createPropertyDto.property_type_id) {
            const propertyTypeExists = await this.propertyRepository.manager.findOne('property_types', { where: { id: createPropertyDto.property_type_id } });
            if (!propertyTypeExists) {
                throw new BadRequestException('Property type not found');
            }
        }
        
        if (createPropertyDto.property_owner_id) {
            const ownerExists = await this.propertyRepository.manager.findOne('users', { where: { id: createPropertyDto.property_owner_id } });
            if (!ownerExists) {
                throw new BadRequestException('Property owner not found');
            }
        }
        
        if (createPropertyDto.contractor_id) {
            const contractorExists = await this.propertyRepository.manager.findOne('users', { where: { id: createPropertyDto.contractor_id } });
            if (!contractorExists) {
                throw new BadRequestException('Contractor not found');
            }
        }


        // Check maxProperties limit from membership plan
        // Determine whose subscription to check
        const targetUserId = (userRole === UserRole.ADMIN && createPropertyDto.contractor_id) 
            ? createPropertyDto.contractor_id 
            : userId;

        if (userRole !== UserRole.ADMIN || (userRole === UserRole.ADMIN && createPropertyDto.contractor_id)) {
            const activeSubscription = await this.subscriptionRepository.findOne({
                where: { userId: targetUserId, status: 'ACTIVE' },
                relations: ['plan'],
            });

            const plan = activeSubscription?.plan;
            const isUnlimitedProperties = plan?.isUnlimitedProperties || plan?.isUnlimitedAccess;
            const maxProperties = plan?.maxProperties ?? 0;

            if (!isUnlimitedProperties) {
                if (maxProperties === 0) {
                    throw new BadRequestException(
                        'Your current membership plan does not allow creating properties. Please upgrade your plan to create properties.'
                    );
                }

                // Count properties created by this user/contractor
                const currentPropertyCount = await this.propertyRepository.count({
                    where: { created_by: targetUserId },
                });

                if (currentPropertyCount >= maxProperties) {
                    throw new BadRequestException(
                        `You have reached the maximum number of properties allowed by your membership plan (${maxProperties}). Please upgrade your plan to add more properties.`
                    );
                }
            }
        }

        // Generate unique parcel_id
        const parcelId = `PARCEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Get state_id, city_name, and state_name from city and state
        const cityQuery = await this.propertyRepository.manager.query(
            'SELECT c.state_id, c.name as city_name, s.state_name FROM cities c JOIN states s ON c.state_id = s.id WHERE c.id = $1', 
            [createPropertyDto.city_id]
        );
        const stateId = cityQuery[0]?.state_id;
        const cityName = cityQuery[0]?.city_name;
        const stateName = cityQuery[0]?.state_name;

        // Extract year from created_at for yearbuilt
        const currentDate = new Date();
        const yearBuilt = currentDate.getFullYear();

        // Handle contractor_id and created_by based on user role
        let contractorId = createPropertyDto.contractor_id;
        let createdBy = userId;

        if (userRole === 'CONTRACTOR' && !contractorId) {
            // Case 1: Contractor creates property - set contractor_id to their own ID
            contractorId = userId;
        } else if (userRole === 'ADMIN' && contractorId) {
            // Case 2: Admin creates property with contractor_id - set created_by to contractor_id
            createdBy = contractorId;
        }

        const propertyData = {
            ...createPropertyDto,
            parcel_id: parcelId,
            state_id: stateId,
            city_name: cityName,
            state_name: stateName,
            yearbuilt: yearBuilt,
            contractor_id: contractorId,
            created_by: createdBy,
            created_at: currentDate,
            updated_at: currentDate
        };

        const property = this.propertyRepository.create(propertyData);
        const savedProperty = await this.propertyRepository.save(property);
        
        // Extract ID safely
        const propertyId = (savedProperty as any).id || (savedProperty as any)[0]?.id;

        // Return property with minimal relations
        const createdProperty = await this.propertyRepository.findOne({
            where: { id: propertyId },
            relations: ['property_type', 'property_owner', 'creator', 'contractor']
        });

        if (!createdProperty) {
            throw new Error('Failed to retrieve created property');
        }

        // Transform the response to include only essential fields
        const { city, state, ...propertyWithoutCityState } = createdProperty;
        
        const response = {
            ...propertyWithoutCityState,
            property_type: createdProperty.property_type ? {
                id: createdProperty.property_type.id,
                type_name: createdProperty.property_type.type_name
            } : null,
            property_owner: createdProperty.property_owner ? {
                id: createdProperty.property_owner.id,
                email: createdProperty.property_owner.email,
                first_name: createdProperty.property_owner.first_name,
                last_name: createdProperty.property_owner.last_name
            } : null,
            creator: createdProperty.creator ? {
                id: createdProperty.creator.id,
                email: createdProperty.creator.email,
                first_name: createdProperty.creator.first_name,
                last_name: createdProperty.creator.last_name
            } : null,
            contractor: createdProperty.contractor ? {
                id: createdProperty.contractor.id,
                email: createdProperty.contractor.email,
                first_name: createdProperty.contractor.first_name,
                last_name: createdProperty.contractor.last_name
            } : null
        };

        return response;
    }

    async updatePropertyImages(
        propertyId: string,
        userId: string,
        frontImageUrl: string | null,
        otherImageUrl: string | null,
        userRole?: string,
    ): Promise<{ id: string; front_image: string | null; other_image: string | null }> {
        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) {
            throw new NotFoundException('Property not found');
        }

        const isAdmin = userRole === UserRole.ADMIN;
        const canUpdate =
            isAdmin ||
            property.created_by === userId ||
            property.contractor_id === userId;

        if (!canUpdate) {
            throw new ForbiddenException('You do not have permission to update images for this property');
        }

        if (!frontImageUrl && !otherImageUrl) {
            throw new BadRequestException('At least one image (front_image or other_image) must be provided');
        }

        const updateData: Partial<Property> = { updated_at: new Date() };
        if (frontImageUrl) {
            updateData.front_image = frontImageUrl;
        }
        if (otherImageUrl) {
            updateData.other_image = otherImageUrl;
        }

        await this.propertyRepository.update(propertyId, updateData);

        const updated = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!updated) {
            throw new NotFoundException('Property not found after update');
        }

        return {
            id: updated.id,
            front_image: updated.front_image,
            other_image: updated.other_image,
        };
    }

    async getUserPropertiesWithComponents(userId: string, userRole: string, hasReport?: boolean): Promise<any[]> {
        // Fetch properties belonging to the user: created_by, property_owner_id, or contractor_id
        const query = this.propertyRepository.createQueryBuilder('property')
            .leftJoinAndSelect('property.property_type', 'property_type')
            .leftJoinAndSelect('property.property_owner', 'property_owner')
            .leftJoinAndSelect('property.creator', 'creator')
            .leftJoinAndSelect('property.contractor', 'contractor')
            .where('(property.created_by = :userId OR property.property_owner_id = :userId OR property.contractor_id = :userId)', { userId });

        // Property owners should always see their own properties regardless of report status.
        // For other roles, apply the hasReport filter when provided.
        if (userRole !== 'PROPERTY_OWNER' && hasReport !== undefined) {
            query.andWhere('property.has_report = :hasReport', { hasReport });
        }

        query.orderBy('property.created_at', 'DESC');

        const properties = await query.getMany();
        if (!properties || properties.length === 0) return [];

        const propertyIds = properties.map(p => p.id);

        // Batch load latest components
        const [allRoofing, allSiding, allWindows, allDoors, allGarageDoors] = await Promise.all([
            this.roofingRepository.find({ where: { property_id: In(propertyIds), isLatest: true }, order: { created_at: 'DESC' } }),
            this.sidingRepository.find({ where: { property_id: In(propertyIds), isLatest: true }, order: { created_at: 'DESC' } }),
            this.windowsRepository.find({ where: { property_id: In(propertyIds), isLatest: true }, order: { created_at: 'DESC' } }),
            this.doorsRepository.find({ where: { property_id: In(propertyIds), isLatest: true }, order: { created_at: 'DESC' } }),
            this.garageDoorsRepository.find({ where: { property_id: In(propertyIds), isLatest: true }, order: { created_at: 'DESC' } }),
        ]);

        const roofingByProperty = new Map<string, any[]>();
        const sidingByProperty = new Map<string, any[]>();
        const windowsByProperty = new Map<string, any[]>();
        const doorsByProperty = new Map<string, any[]>();
        const garageDoorsByProperty = new Map<string, any[]>();

        const groupByProperty = (map: Map<string, any[]>, item: { property_id: string }) => {
            const arr = map.get(item.property_id) || [];
            arr.push(item);
            map.set(item.property_id, arr);
        };

        allRoofing.forEach((r) => groupByProperty(roofingByProperty, r));
        allSiding.forEach((s) => groupByProperty(sidingByProperty, s));
        allWindows.forEach((w) => groupByProperty(windowsByProperty, w));
        allDoors.forEach((d) => groupByProperty(doorsByProperty, d));
        allGarageDoors.forEach((g) => groupByProperty(garageDoorsByProperty, g));

        // Format response
        const formatUser = (user: any) => user ? {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        } : null;

        return properties.map(property => {
            const roofing = roofingByProperty.get(property.id) || [];
            const siding = sidingByProperty.get(property.id) || [];
            const windows = windowsByProperty.get(property.id) || [];
            const doors = doorsByProperty.get(property.id) || [];
            const garageDoors = garageDoorsByProperty.get(property.id) || [];

            const components = [
                ...roofing.map(r => { 
                    const { brand_id, ...rest } = r; 
                    return { 
                        ...rest, 
                        component_type: 'ROOFING',
                        owner_images: {}, // Empty object as placeholder
                        owner_uploaded: false // Default to false
                    }; 
                }),
                ...siding.map(s => { 
                    const { brand_id, ...rest } = s; 
                    return { 
                        ...rest, 
                        component_type: 'SIDING',
                        owner_images: {}, // Empty object as placeholder
                        owner_uploaded: false // Default to false
                    }; 
                }),
                ...windows.map(w => { 
                    const { brand_id, ...rest } = w; 
                    return { 
                        ...rest, 
                        component_type: 'WINDOWS',
                        owner_images: {}, // Empty object as placeholder
                        owner_uploaded: false // Default to false
                    }; 
                }),
                ...doors.map(d => { 
                    const { brand_id, ...rest } = d; 
                    return { 
                        ...rest, 
                        component_type: 'DOORS',
                        owner_images: {}, // Empty object as placeholder
                        owner_uploaded: false // Default to false
                    }; 
                }),
                ...garageDoors.map(g => { 
                    const { brand_id, ...rest } = g; 
                    return { 
                        ...rest, 
                        component_type: 'GARAGE_DOORS',
                        owner_images: {}, // Empty object as placeholder
                        owner_uploaded: false // Default to false
                    }; 
                }),
            ];

            return {
                ...property,
                property_type: property.property_type ? { id: property.property_type.id, type_name: (property.property_type as any).type_name } : null,
                property_owner: formatUser(property.property_owner),
                creator: formatUser(property.creator),
                contractor: formatUser(property.contractor),
                components,
            };
        });
    }

    async adminUpdateProperty(id: string, updatePropertyDto: any, req: any): Promise<any> {
        // Find the property first
        const property = await this.propertyRepository.findOne({
            where: { id },
            relations: ['city', 'state', 'property_type', 'property_owner', 'creator', 'contractor']
        });
        
        if (!property) {
            throw new Error('Property not found');
        }

        // Update the property with provided data
        await this.propertyRepository.update(id, {
            ...updatePropertyDto,
            updated_at: new Date()
        });

        // Return updated property with relations
        return await this.propertyRepository.findOne({
            where: { id },
            relations: ['city', 'state', 'property_type', 'property_owner', 'creator', 'contractor']
        });
    }

    async deleteProperty(id: string, req: any): Promise<void> {
        // Empty implementation
    }


    async addComment(propertyId: string, commentDto: any, userId: string): Promise<any> {
        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) {
            throw new NotFoundException('Property not found');
        }
        const comment = this.propertyCommentRepository.create({
            property_id: propertyId,
            user_id: userId,
            comment: commentDto.comment,
        });
        const savedComment = await this.propertyCommentRepository.save(comment);
        return savedComment;
    }

    async getPropertyComments(propertyId: string, userId: string, userRole: string, commentId?: string): Promise<any[]> {
        const where: any = { property_id: propertyId };
        if (commentId) {
            where.id = commentId;
        }
        const comments = await this.propertyCommentRepository.find({
            where,
            relations: ['user'],
            order: { created_at: 'DESC' },
        });
        // Filter based on role if needed – owners and admins can see all, others see only their own comments
        if (userRole !== UserRole.PROPERTY_OWNER && userRole !== UserRole.ADMIN && userRole !== UserRole.CITY_INSPECTOR) {
            return comments.filter(c => c.user_id === userId);
        }
        return comments;
    }
}