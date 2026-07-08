import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
import { PropertyProject, ProjectType, ProjectStatus } from '../entities/property-project.entity';
import { Property } from '../entities/property.entity';
import { City } from '../entities/city.entity';
import { User, UserRole } from '../entities/user.entity';
import { Subscription } from '../entities/subscription.entity';
import { MembershipPlan } from '../entities/membership-plan.entity';
import { CreatePropertyProjectDto } from './dto/create-property-project.dto';
import { UpdatePropertyProjectDto } from './dto/update-property-project.dto';

@Injectable()
export class PropertyProjectsService {
    constructor(
        @InjectRepository(PropertyProject)
        private propertyProjectRepository: Repository<PropertyProject>,
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Subscription)
        private subscriptionRepository: Repository<Subscription>,
        @InjectRepository(MembershipPlan)
        private membershipPlanRepository: Repository<MembershipPlan>,
    ) {}

    private normalizeProjectType(type: string): ProjectType {
        const normalized = type.trim().toUpperCase().replace(/\s+/g, '_');
        if (!Object.values(ProjectType).includes(normalized as ProjectType)) {
            throw new BadRequestException(`Invalid project type. Must be one of: ${Object.values(ProjectType).join(', ')}`);
        }
        return normalized as ProjectType;
    }

    private normalizeVisibleStatus(status: string): string {
        const normalized = status.trim().toLowerCase();
        if (normalized !== 'public' && normalized !== 'private') {
            throw new BadRequestException("visible_status must be either 'public' or 'private'");
        }
        return normalized;
    }

    private normalizeProjectStatus(status: string): ProjectStatus {
        const normalized = status.trim().toUpperCase();
        if (!Object.values(ProjectStatus).includes(normalized as ProjectStatus)) {
            throw new BadRequestException(`Invalid project status. Must be one of: ${Object.values(ProjectStatus).join(', ')}`);
        }
        return normalized as ProjectStatus;
    }

    private async validateGoverningCityId(governingCityId: string): Promise<void> {
        const cityExists = await this.propertyProjectRepository.manager.findOne(City, {
            where: { id: governingCityId }
        });

        if (!cityExists) {
            throw new BadRequestException(`Governing city with ID "${governingCityId}" does not exist`);
        }
    }

    private hasValidGoverningCityId(governingCityId?: string): governingCityId is string {
        return governingCityId !== undefined && governingCityId !== null && governingCityId.trim() !== '';
    }

    private handlePropertyProjectSaveError(error: unknown): never {
        if (error instanceof QueryFailedError && `${error.message}`.includes('FK_property_project_governing_city_id')) {
            throw new BadRequestException('Invalid governing_city_id: provided governing city does not exist');
        }
        throw error;
    }

    async create(propertyId: string, dto: CreatePropertyProjectDto, userId: string, userRole: string): Promise<PropertyProject> {
        // Verify property exists
        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) {
            throw new NotFoundException(`Property with ID "${propertyId}" not found`);
        }

        // Check maxProjects limit from active membership plan for all roles except ADMIN
        if (userRole !== UserRole.ADMIN) {
            const activeSubscription = await this.subscriptionRepository.findOne({
                where: { userId, status: 'ACTIVE' },
                relations: ['plan'],
            });

            const plan = activeSubscription?.plan;
            const isUnlimitedProjects = plan?.isUnlimitedProjects || plan?.isUnlimitedAccess;
            const maxProjects = plan?.maxProjects ?? 0;

            if (!isUnlimitedProjects) {
                if (maxProjects === 0) {
                    throw new BadRequestException(
                        'Your current membership plan does not allow adding projects. Please upgrade your plan to add more projects.'
                    );
                }

                // Count all projects this user has created across all their properties
                const currentProjectCount = await this.propertyProjectRepository.count({
                    where: { created_by: userId },
                });

                if (currentProjectCount >= maxProjects) {
                    throw new BadRequestException(
                        `You have reached the maximum number of projects allowed by your membership plan (${maxProjects}). Please upgrade your plan to add more projects.`
                    );
                }
            }
        }

        let projectType: ProjectType;
        let otherText: string | null = null;
        let visibleStatus: string = 'public';

        // --- CASE 2: PROPERTY OWNER FLOW ---
        if (userRole === UserRole.PROPERTY_OWNER) {
            // 1. Dynamic validation for visible_status
            if (!dto.visible_status) {
                throw new BadRequestException('visible_status is required for property owners');
            }
            const normalizedStatus = dto.visible_status.trim().toLowerCase();
            if (normalizedStatus !== 'public' && normalizedStatus !== 'private') {
                throw new BadRequestException("visible_status must be either 'public' or 'private'");
            }
            visibleStatus = normalizedStatus;

            // 2. Dynamic validation & normalization for project_type
            // Map spaces/various cases to underscore snake_case (e.g., 'New Yard Work' -> 'NEW_YARD_WORK')
            const normalizedType = dto.project_type.trim().toUpperCase().replace(/\s+/g, '_');
            
            const homeownerPredefined = [
                'NEW_CABINETS',
                'NEW_APPLIANCES',
                'NEW_FURNACE',
                'NEW_AC',
                'ADDED_ROOM',
                'NEW_YARD_WORK',
                'OTHER'
            ];

            if (!homeownerPredefined.includes(normalizedType)) {
                throw new BadRequestException(
                    `Invalid property owner project type. Must be one of: ${homeownerPredefined.join(', ')}`
                );
            }

            projectType = normalizedType as ProjectType;
            if (projectType === ProjectType.OTHER) {
                if (!dto.other || dto.other.trim() === '') {
                    throw new BadRequestException("The 'other' field is required when project type is 'OTHER'");
                }
                otherText = dto.other.trim();
            }

            // If contractor_id is provided, verify it exists and is a contractor
            let contractorId: string | undefined = undefined;
            if (dto.contractor_id) {
                const contractor = await this.userRepository.findOne({ 
                    where: { id: dto.contractor_id },
                    relations: ['roleEntity']
                });
                if (!contractor) {
                    throw new NotFoundException(`Contractor with ID "${dto.contractor_id}" not found`);
                }
                if ((contractor.role !== UserRole.CONTRACTOR && contractor.role !== UserRole.MANUFACTURER)) {
                    throw new BadRequestException('Selected user is not a contractor');
                }
                contractorId = dto.contractor_id;
            }

            // 3. Create project
            if (this.hasValidGoverningCityId(dto.governing_city_id)) {
                await this.validateGoverningCityId(dto.governing_city_id);
            }

            const project = this.propertyProjectRepository.create({
                property_id: propertyId,
                project_name: dto.project_name,
                project_type: projectType,
                other: otherText,
                visible_status: visibleStatus,
                created_by: userId,
                date_of_install: dto.date_of_install ? new Date(dto.date_of_install) : undefined,
                permit: dto.permit !== undefined ? dto.permit : undefined,
                need_permit: dto.need_permit !== undefined ? dto.need_permit : false,
                governing_city_id: this.hasValidGoverningCityId(dto.governing_city_id) ? dto.governing_city_id : undefined,
                project_status: dto.project_status || ProjectStatus.DRAFT,
                notes: dto.notes !== undefined ? dto.notes : undefined,
                contractor_id: contractorId,
            });

            return await this.propertyProjectRepository.save(project).catch(error => this.handlePropertyProjectSaveError(error));
        }

        // --- CASE 1: CONTRACTOR / ADMIN FLOW ---
        else {
            const contractorPredefined = ['ROOFING', 'SIDING',  'WINDOWS', 'DOORS', 'GARAGE_DOORS'];
            const normalizedType = dto.project_type.trim().toUpperCase().replace(/\s+/g, '_');

            if (!contractorPredefined.includes(normalizedType)) {
                throw new BadRequestException('Invalid contractor project type. Must be ROOFING, SIDING, WINDOWS, DOORS, GARAGE_DOORS');
            }

            projectType = normalizedType as ProjectType;

            // If contractor_id is provided, verify it exists and is a contractor
            if (dto.contractor_id) {
                const contractor = await this.userRepository.findOne({ 
                    where: { id: dto.contractor_id },
                    relations: ['roleEntity']
                });
                if (!contractor) {
                    throw new NotFoundException(`Contractor with ID "${dto.contractor_id}" not found`);
                }
                if ((contractor.role !== UserRole.CONTRACTOR && contractor.role !== UserRole.MANUFACTURER)) {
                    throw new BadRequestException('Selected user is not a contractor');
                }
            }

            // Set contractor_id based on user role
            let contractorId = dto.contractor_id;
            if ((userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) && !contractorId) {
                contractorId = userId;
            }


            if (dto.need_permit !== true) {
                throw new BadRequestException('need_permit must be true for roofing, siding, windows, doors, and garage doors projects');
            }

            if (this.hasValidGoverningCityId(dto.governing_city_id)) {
                await this.validateGoverningCityId(dto.governing_city_id);
            }

            // Create project
            const project = this.propertyProjectRepository.create({
                property_id: propertyId,
                project_name: dto.project_name,
                project_type: projectType,
                visible_status: 'public', // Contractors default to public
                contractor_id: contractorId || undefined,
                created_by: userId,
                date_of_install: dto.date_of_install ? new Date(dto.date_of_install) : undefined,
                permit: dto.permit !== undefined ? dto.permit : undefined,
                need_permit: true,
                governing_city_id: this.hasValidGoverningCityId(dto.governing_city_id) ? dto.governing_city_id : undefined,
                project_status: dto.project_status || ProjectStatus.DRAFT,
                notes: dto.notes !== undefined ? dto.notes : undefined,
            });

            return await this.propertyProjectRepository.save(project).catch(error => this.handlePropertyProjectSaveError(error));
        }
    }

    async update(id: string, dto: UpdatePropertyProjectDto, userId: string, userRole: string): Promise<PropertyProject> {
        const project = await this.propertyProjectRepository.findOne({ 
            where: { id },
            relations: ['property']
        });
        if (!project) {
            throw new NotFoundException(`Property project with ID "${id}" not found`);
        }

        // Logic for Contractor / Manufacturer
        if (userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) {
            // Verify the user is the creator
            if (project.created_by !== userId) {
                throw new ForbiddenException('You can only update projects that you created');
            }

            if (dto.project_status) {
                const newStatus = this.normalizeProjectStatus(dto.project_status);
                
                // Contractor cannot revert COMPLETE back to DRAFT
                if (project.project_status === ProjectStatus.COMPLETE && newStatus === ProjectStatus.DRAFT) {
                    throw new BadRequestException('Contractors cannot revert a completed project to draft status');
                }

                project.project_status = newStatus;
                return await this.propertyProjectRepository.save(project).catch(error => this.handlePropertyProjectSaveError(error));
            }

            return project; // Ignore any other fields sent by the frontend
        }

        // Only admin can edit fields other than project_status
        if (userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only administrators can fully edit property projects');
        }

        // If contractor_id is being updated, verify it exists and is a contractor
        if (dto.contractor_id) {
            const contractor = await this.userRepository.findOne({ 
                where: { id: dto.contractor_id },
                relations: ['roleEntity']
            });
            if (!contractor) {
                throw new NotFoundException(`Contractor with ID "${dto.contractor_id}" not found`);
            }
            if ((contractor.role !== UserRole.CONTRACTOR && contractor.role !== UserRole.MANUFACTURER)) {
                throw new BadRequestException('Selected user is not a contractor');
            }
        }

        // Prepare update data (project_type is ignored to prevent changes)
        const updateData: any = {};
        
        // Use existing project_type and need_permit for validation
        const resultingProjectType = project.project_type;
        const resultingNeedPermit = dto.need_permit !== undefined
            ? dto.need_permit
            : project.need_permit;

        if (['ROOFING', 'SIDING', 'WINDOWS', 'DOORS', 'GARAGE_DOORS'].includes(resultingProjectType) && !resultingNeedPermit) {
            throw new BadRequestException('need_permit must be true for roofing, siding, windows, doors, and garage doors projects');
        }

        if (dto.project_name !== undefined) updateData.project_name = dto.project_name;
        // project_type is intentionally ignored to prevent updates
        if (dto.date_of_install !== undefined) updateData.date_of_install = new Date(dto.date_of_install);
        if (dto.permit !== undefined) updateData.permit = dto.permit;
        if (dto.need_permit !== undefined) updateData.need_permit = dto.need_permit;
        if (dto.governing_city_id !== undefined) {
            await this.validateGoverningCityId(dto.governing_city_id);
            updateData.governing_city_id = dto.governing_city_id;
        }
        if (dto.project_status !== undefined) updateData.project_status = this.normalizeProjectStatus(dto.project_status);
        if (dto.contractor_id !== undefined) updateData.contractor_id = dto.contractor_id;
        if (dto.visible_status !== undefined) updateData.visible_status = this.normalizeVisibleStatus(dto.visible_status);
        if (dto.other !== undefined) updateData.other = dto.other;
        if (dto.notes !== undefined) updateData.notes = dto.notes;

        // Update project
        Object.assign(project, updateData);

        const savedProject = await this.propertyProjectRepository.save(project).catch(error => this.handlePropertyProjectSaveError(error));

        return savedProject;
    }

    async remove(id: string, userId: string, userRole: string): Promise<void> {
        // Only admin can delete
        if (userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only administrators can delete property projects');
        }

        const project = await this.propertyProjectRepository.findOne({ where: { id } });
        if (!project) {
            throw new NotFoundException(`Property project with ID "${id}" not found`);
        }

        await this.propertyProjectRepository.remove(project);
    }

    async getProjectDetailsWithImages(propertyId: string, addedBy?: string, projectType?: string): Promise<any[]> {
        const query = this.propertyProjectRepository.createQueryBuilder('project')
            .leftJoinAndSelect('project.property', 'property')
            .where('project.property_id = :propertyId', { propertyId })
            .orderBy('project.created_at', 'DESC');

        if (projectType) {
            query.andWhere('project.project_type = :projectType', { projectType: projectType.toUpperCase() });
        }

        if (addedBy) {
            query.innerJoin('project.createdBy', 'creator')
                 .innerJoin('creator.roleEntity', 'roleEntity');
            
            const role = addedBy.toUpperCase();
            if (role === 'CONTRACTOR') {
                query.andWhere('roleEntity.role_name IN (:...roles)', { roles: [UserRole.CONTRACTOR, UserRole.MANUFACTURER] });
            } else {
                query.andWhere('roleEntity.role_name = :role', { role });
            }
        }

        const projects = await query.getMany();
        const results: any[] = [];

        for (const project of projects) {
            let componentDetails: any = null;
            let images: any[] = [];
            
            if (['ROOFING', 'SIDING', 'WINDOWS', 'DOORS', 'GARAGE_DOORS'].includes(project.project_type)) {
                // Contractor component
                const repoName = project.project_type.toLowerCase() === 'garage_doors' ? 'garage_doors' : project.project_type.toLowerCase();
                try {
                    const repo = this.propertyProjectRepository.manager.getRepository(repoName);
                    // Fetch the latest component linked to this project
                    componentDetails = await repo.findOne({ where: { project_id: project.id, isLatest: true } });
                    
                    if (componentDetails) {
                        images = await this.propertyProjectRepository.manager.query(
                            'SELECT * FROM report_images WHERE component_id = $1',
                            [componentDetails.id]
                        );
                    }
                } catch (e) {
                    console.error(`Error fetching component details for ${project.project_type}`, e);
                }
            } else {
                // Home owner project
                try {
                    const ownerProjectRepo = this.propertyProjectRepository.manager.getRepository('owner_projects');
                    componentDetails = await ownerProjectRepo.findOne({ where: { project_id: project.id } });
                    
                    if (componentDetails) {
                        images = await this.propertyProjectRepository.manager.query(
                            'SELECT * FROM report_images WHERE owner_project_id = $1',
                            [componentDetails.id]
                        );
                    }
                } catch (e) {
                    console.error('Error fetching owner project details', e);
                }
            }

            results.push({
                ...project,
                details: componentDetails,
                images: images
            });
        }

        return results;
    }

    async getProjectTypesByPropertyId(propertyId: string, addedBy?: string): Promise<string[]> {
        // Return all available project types regardless of whether they exist for this property
        const allProjectTypes = [
            // Contractor types
            'ROOFING',
            'SIDING',
            'WINDOWS',
            'DOORS',
            'GARAGE_DOORS',
            // Property owner types
            'NEW_CABINETS',
            'NEW_APPLIANCES',
            'NEW_FURNACE',
            'NEW_AC',
            'ADDED_ROOM',
            'NEW_YARD_WORK',
            'OTHER'
        ];
        
        return allProjectTypes;
    }

    async getUserPropertiesWithFullProjects(userId: string, userRole: string): Promise<any[]> {
        let propertyIds: string[] = [];

        if (userRole === UserRole.PROPERTY_OWNER) {
            const props = await this.propertyRepository.find({ where: { property_owner_id: userId }, select: ['id'] });
            propertyIds = props.map(p => p.id);
        } else if (userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) {
            const props = await this.propertyRepository.find({ where: { created_by: userId }, select: ['id'] });
            const myProps = props.map(p => p.id);

            const projects = await this.propertyProjectRepository.find({
                where: [
                    { created_by: userId },
                    { contractor_id: userId }
                ],
                select: ['property_id']
            });
            const myProjectProps = projects.map(p => p.property_id);

            propertyIds = [...new Set([...myProps, ...myProjectProps])];
        } else {
            throw new ForbiddenException('Invalid role for this operation');
        }

        if (propertyIds.length === 0) {
            return [];
        }

        const properties = await this.propertyRepository.find({
            where: { id: In(propertyIds) },
            relations: ['property_owner'],
        });
        const results: any[] = [];

        for (const property of properties) {
            const projects = await this.getProjectDetailsWithImages(property.id);
            // Filter to only include projects that this contractor/manufacturer added, OR if it's their property?
            // Wait, the user said: "get projects of other properties which he di not create but he addded project in that ... so that property should also appear in response ... it should appear that project of that property in response".
            // Let's only return projects if the user has access. Actually getProjectDetailsWithImages returns ALL projects for a property. 
            // The prompt says "it should appear that project of that property in response". 
            // Let's filter projects for CONTRACTOR/MANUFACTURER if it's NOT their property. 
            // If they created the property, maybe they see all projects. If they didn't create the property, they should only see projects they created or are the contractor for.
            // But for simplicity and to match the prompt "so when that contractor call api it should appear that project of that property in response", returning only their projects is safer for privacy.
            
            let filteredProjects = projects;
            if (userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER) {
                filteredProjects = projects.filter(p => p.created_by === userId || p.contractor_id === userId);
            }

            for (const project of filteredProjects) {
                results.push({
                    ...project,
                    property: {
                        ...property,
                        property_owner_email: property.property_owner?.email ?? null,
                    },
                });
            }
        }

        return results;
    }
}