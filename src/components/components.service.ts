import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { Property } from '../entities/property.entity';
import { PropertyProject, ProjectType } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { Report } from '../entities/report.entity';
import { Brand, BrandCategory } from '../entities/brand.entity';
import { RoofingDto } from './dto/roofing.dto';
import { SidingDto } from './dto/siding.dto';
import { WindowsDto } from './dto/windows.dto';
import { DoorsDto } from './dto/doors.dto';
import { GarageDoorsDto } from './dto/garage-doors.dto';
import { ReportsService } from '../reports/reports.service';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class ComponentsService {
    constructor(
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
        @InjectRepository(Report)
        private reportRepository: Repository<Report>,
        @InjectRepository(Brand)
        private brandRepository: Repository<Brand>,
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>,
        @InjectRepository(PropertyProject)
        private propertyProjectRepository: Repository<PropertyProject>,
        @InjectRepository(OwnerProject)
        private ownerProjectRepository: Repository<OwnerProject>,
        private readonly reportsService: ReportsService,
    ) { }

    private async validatePropertyProject(propertyId: string, componentType: string, userId: string, projectId: string): Promise<PropertyProject> {
        // Check if property project exists for this property
        const propertyProject = await this.propertyProjectRepository.findOne({
            where: {
                id: projectId,
                property_id: propertyId,
                created_by: userId // Only check projects created by the same user
            }
        });

        if (!propertyProject) {
            throw new BadRequestException({
                message: `Cannot add ${componentType.toLowerCase()} component. Property project with ID '${projectId}' was not found for this property and user.`,
                error: 'PROPERTY_PROJECT_REQUIRED',
                componentType: componentType,
                propertyId: propertyId,
                projectId: projectId,
                solution: 'Verify that the provided project_id is correct and belongs to you'
            });
        }

        // Map component types to project types
        const componentToProjectTypeMap = {
            'ROOFING': ProjectType.ROOFING,
            'SIDING': ProjectType.SIDING,
            'WINDOWS': ProjectType.WINDOWS,
            'DOORS': ProjectType.DOORS,
            'GARAGE_DOORS': ProjectType.GARAGE_DOORS,
        };

        const expectedProjectType = componentToProjectTypeMap[componentType as keyof typeof componentToProjectTypeMap];
        
        if (propertyProject.project_type !== expectedProjectType) {
            throw new BadRequestException({
                message: `Cannot add ${componentType.toLowerCase()} component. The property project type is '${propertyProject.project_type}' but you're trying to add a '${componentType}' component.`,
                error: 'PROJECT_TYPE_MISMATCH',
                componentType: componentType,
                propertyId: propertyId,
                projectType: propertyProject.project_type,
                expectedProjectType: expectedProjectType,
                solution: `Create a ${expectedProjectType} project or add a ${propertyProject.project_type.toLowerCase()} component instead`
            });
        }

        return propertyProject;
    }

    private isAdmin(userRole: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    private async resolveProjectContractorId(projectId: string | null, propertyId: string): Promise<string | null> {
        if (!projectId) return null;

        const propertyProject = await this.propertyProjectRepository.findOne({
            where: { id: projectId, property_id: propertyId }
        });

        if (!propertyProject) {
            throw new BadRequestException(`Project with ID '${projectId}' was not found for this property.`);
        }

        return propertyProject.contractor_id || null;
    }

    private async transformComponentResponse(component: any): Promise<any> {
        if (!component) return component;

        // Remove internal foreign-key fields from API payloads
        const { brand_id, ...sanitized } = component as any;
        return sanitized;
    }

    private async validateBrandById(brandId?: string, expectedCategories?: BrandCategory[]): Promise<Brand> {
        if (!brandId || brandId.trim().length === 0) {
            throw new BadRequestException({
                message: 'Brand ID is required',
                error: 'MISSING_BRAND_ID'
            });
        }

        const trimmedBrandId = brandId.trim();
        
        // Check if brand exists in brands table
        const existingBrand = await this.brandRepository.findOne({ 
            where: { id: trimmedBrandId } 
        });

        if (existingBrand) {
            // Check if brand matches the expected category
            if (expectedCategories && expectedCategories.length > 0) {
                if (!expectedCategories.includes(existingBrand.category as BrandCategory)) {
                    throw new BadRequestException({
                        message: `Invalid brand category.`,
                        error: 'BRAND_CATEGORY_MISMATCH'
                    });
                }
            }
            // Brand exists and category is valid - return the brand object
            return existingBrand;
        } else {
            // Brand doesn't exist - reject it
            throw new BadRequestException({
                message: 'Invalid brand selection',
                error: 'BRAND_NOT_FOUND'
            });
        }
    }

    private async resolveBrandForComponent(brandId?: string, otherBrand?: string, expectedCategory?: string): Promise<{ brandName: string | null; otherBrandName: string | null }> {
        if (brandId) {
            // Enforce category check for predefined brand
            const brand = await this.validateBrandById(brandId, [expectedCategory as BrandCategory]);
            return { brandName: brand.name, otherBrandName: null };
        }

        if (otherBrand) {
            const trimmedOther = otherBrand.trim();
            if (trimmedOther) {
                // Check if brand already exists (case-insensitive) in the brands table
                const existingBrand = await this.brandRepository.createQueryBuilder('brand')
                    .where('LOWER(brand.name) = LOWER(:name)', { name: trimmedOther })
                    .getOne();

                if (existingBrand) {
                    // Brand already exists - throw validation error
                    throw new BadRequestException({
                        statusCode: 400,
                        message: 'Brand Already Exists',
                        error: 'DUPLICATE_BRAND_NAME',
                        details: {
                            reason: `Brand name '${trimmedOther}' already exists${existingBrand.category ? ` in ${existingBrand.category} category` : ''}`,
                            existingBrandId: existingBrand.id,
                            existingBrandName: existingBrand.name,
                            category: existingBrand.category,
                            expectedCategory,
                            solution: 'Please select the existing brand from the dropdown or choose a different name'
                        }
                    });
                }

                // Create new brand in brands table
                const brand = this.brandRepository.create({
                    name: trimmedOther,
                    category: expectedCategory
                });
                await this.brandRepository.save(brand);

                return { brandName: brand.name, otherBrandName: trimmedOther };
            }
        }

        return { brandName: null, otherBrandName: null };
    }

    async canAddComponent(propertyId: string, userId: string, userRole: string): Promise<{ canAdd: boolean; reason?: string; reportId?: string }> {
        // Check if report already exists for this property
        const existingReport = await this.reportRepository.findOne({
            where: { property_id: propertyId }
        });

        // If no report exists, anyone can add components
        if (!existingReport) {
            return { canAdd: true };
        }

        // If report exists and is immutable, only admin can add components
        if (existingReport.immutable && !this.isAdmin(userRole)) {
            return { 
                canAdd: false, 
                reason: `Report has already been generated for this property and is now locked. Only administrators can modify components after report generation. Report ID: ${existingReport.id}`,
                reportId: existingReport.id
            };
        }

        return { canAdd: true };
    }

    async canModifyComponent(propertyId: string, userId: string, userRole: string): Promise<{ canModify: boolean; reason?: string; reportId?: string }> {
        // Check if report already exists for this property
        const existingReport = await this.reportRepository.findOne({
            where: { property_id: propertyId }
        });

        // If no report exists, anyone can modify components
        if (!existingReport) {
            return { canModify: true };
        }

        // If report exists and is immutable, only admin can modify components
        if (existingReport.immutable && !this.isAdmin(userRole)) {
            return { 
                canModify: false, 
                reason: `Report has already been generated for this property and is now locked. Only administrators can modify components after report generation. Report ID: ${existingReport.id}`,
                reportId: existingReport.id
            };
        }

        return { canModify: true };
    }

    async saveRoofing(dto: RoofingDto, userId: string, userRole: string): Promise<Roofing> {
        // Validate property project exists and matches component type
        const propertyProject = await this.validatePropertyProject(dto.property_id!, 'ROOFING', userId, dto.project_id);

        // Resolve brand name and other_brand
        const { brandName, otherBrandName } = await this.resolveBrandForComponent(dto.brand_id, dto.other_brand, 'ROOFING');

        // Multiple roofing components are allowed per property



        // Validate property ownership
        const property = await this.propertyRepository.findOne({ where: { id: dto.property_id } });
        if (!property) throw new NotFoundException('Property not found');

        try {
            
            // Create roofing with brand name (for backward compatibility)
            const roofingData: any = {
                property_id: dto.property_id,
                project_id: dto.project_id || null,
                contractor_id: propertyProject.contractor_id || null,
                description: dto.description,
                type: dto.type,
                install_date: dto.install_date,
                supplier: dto.supplier,
                installer: dto.installer,
                brand: brandName,  // Store brand name for backward compatibility
                other_brand: otherBrandName,
                manufacturer: dto.manufacturer || null,
                where_install: dto.where_install || null,
                style: dto.style,
                color: dto.color,
                material: dto.material,
                impact_resistant: dto.impact_resistant,
                class_rating: dto.class_rating
            };
            
            const roofing = this.roofingRepository.create(roofingData);
            const savedRoofing = await this.roofingRepository.save(roofing as any);
            return await this.transformComponentResponse(savedRoofing);
        } catch (error: any) {
            if (error.message?.includes('foreign key constraint')) {
                throw new BadRequestException({
                    message: 'Cannot add roofing component. The property may not exist or a report has already been generated for this property.',
                    error: 'INVALID_PROPERTY_OR_REPORT_EXISTS',
                    componentType: 'ROOFING',
                    propertyId: dto.property_id
                });
            }
            if (error.message?.includes('duplicate key value') || error.message?.includes('brands_brand_name_key')) {
                throw new BadRequestException({
                    message: `Cannot add roofing component. The brand '${dto.other_brand || dto.brand_id}' already exists.`,
                    error: 'DUPLICATE_BRAND_NAME',
                    componentType: 'ROOFING',
                    propertyId: dto.property_id,
                    existingBrandName: dto.other_brand?.trim() || undefined
                });
            }
            throw error;
        }
    }

    async updateRoofing(componentId: string, dto: Partial<RoofingDto>, userId: string, userRole: string): Promise<Roofing> {
        // Find existing component
        const existingRoofing = await this.roofingRepository.findOne({ where: { id: componentId } });
        if (!existingRoofing) {
            throw new NotFoundException(`Roofing component with ID ${componentId} not found`);
        }

        // Check if user can modify components
        const canModifyResult = await this.canModifyComponent(existingRoofing.property_id, userId, userRole);
        if (!canModifyResult.canModify) {
            throw new BadRequestException({
                message: canModifyResult.reason,
                error: 'REPORT_ALREADY_GENERATED',
                reportId: canModifyResult.reportId,
                componentType: 'ROOFING',
                propertyId: existingRoofing.property_id
            });
        }

        // Validate brand if provided
        const updateData: any = { ...dto };
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.ROOFING]);
            updateData.brand = brand.name;  // Store brand name for backward compatibility
            delete updateData.brand_id;  // Remove brand_id from update data
        }

        if ('project_id' in dto) {
            updateData.contractor_id = await this.resolveProjectContractorId(dto.project_id ?? null, existingRoofing.property_id);
        }

        // Update the component
        await this.roofingRepository.update(componentId, updateData);
        const updatedRoofing = await this.roofingRepository.findOne({ where: { id: componentId } }) as Roofing;
        return await this.transformComponentResponse(updatedRoofing);
    }

    async saveSiding(dto: SidingDto, userId: string, userRole: string): Promise<Siding> {
        // Validate property project exists and matches component type
        const propertyProject = await this.validatePropertyProject(dto.property_id!, 'SIDING', userId, dto.project_id);

        // Resolve brand name and other_brand
        const { brandName, otherBrandName } = await this.resolveBrandForComponent(dto.brand_id, dto.other_brand, 'SIDING');

        // Multiple siding components are allowed per property



        // Validate property ownership
        const property = await this.propertyRepository.findOne({ where: { id: dto.property_id } });
        if (!property) throw new NotFoundException('Property not found');

        try {
            
            // Create siding with brand name (for backward compatibility)
            const sidingData: any = {
                property_id: dto.property_id,
                project_id: dto.project_id || null,
                contractor_id: propertyProject.contractor_id || null,
                description: dto.description,
                type: dto.type,
                install_date: dto.install_date,
                supplier: dto.supplier,
                installer: dto.installer,
                brand: brandName,  // Store brand name for backward compatibility
                other_brand: otherBrandName,
                manufacturer: dto.manufacturer || null,
                where_install: dto.where_install || null,
                style: dto.style,
                color: dto.color,
                material: dto.material,
                elevation_data: dto.elevation_data
            };
            
            const siding = this.sidingRepository.create(sidingData);
            const savedSiding = await this.sidingRepository.save(siding as any);
            return await this.transformComponentResponse(savedSiding);
        } catch (error: any) {
            if (error.message?.includes('foreign key constraint')) {
                throw new BadRequestException({
                    message: 'Cannot add siding component. The property may not exist or a report has already been generated for this property.',
                    error: 'INVALID_PROPERTY_OR_REPORT_EXISTS',
                    componentType: 'SIDING',
                    propertyId: dto.property_id
                });
            }
            if (error.message?.includes('duplicate key value') || error.message?.includes('brands_brand_name_key')) {
                throw new BadRequestException({
                    message: `Cannot add siding component. The brand '${dto.other_brand || dto.brand_id}' already exists.`,
                    error: 'DUPLICATE_BRAND_NAME',
                    componentType: 'SIDING',
                    propertyId: dto.property_id,
                    existingBrandName: dto.other_brand?.trim() || undefined
                });
            }
            throw error;
        }
    }

    async updateSiding(componentId: string, dto: Partial<SidingDto>, userId: string, userRole: string): Promise<Siding> {
        // Find existing component
        const existingSiding = await this.sidingRepository.findOne({ where: { id: componentId } });
        if (!existingSiding) {
            throw new NotFoundException(`Siding component with ID ${componentId} not found`);
        }

        // Check if user can modify components
        const canModifyResult = await this.canModifyComponent(existingSiding.property_id, userId, userRole);
        if (!canModifyResult.canModify) {
            throw new BadRequestException({
                message: canModifyResult.reason,
                error: 'REPORT_ALREADY_GENERATED',
                reportId: canModifyResult.reportId,
                componentType: 'SIDING',
                propertyId: existingSiding.property_id
            });
        }

        // Validate brand if provided
        const updateData: any = { ...dto };
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.SIDING]);
            updateData.brand = brand.name;  // Store brand name for backward compatibility
            delete updateData.brand_id;  // Remove brand_id from update data
        }

        if ('project_id' in dto) {
            updateData.contractor_id = await this.resolveProjectContractorId(dto.project_id ?? null, existingSiding.property_id);
        }

        // Update the component
        await this.sidingRepository.update(componentId, updateData);
        const updatedSiding = await this.sidingRepository.findOne({ where: { id: componentId } }) as Siding;
        return await this.transformComponentResponse(updatedSiding);
    }

    async saveWindows(dto: WindowsDto, userId: string, userRole: string): Promise<Windows> {
        // Validate property project exists and matches component type
        const propertyProject = await this.validatePropertyProject(dto.property_id!, 'WINDOWS', userId, dto.project_id);

        // Resolve brand name and other_brand
        const { brandName, otherBrandName } = await this.resolveBrandForComponent(dto.brand_id, dto.other_brand, 'WINDOWS');

        // Validate property ownership
        const property = await this.propertyRepository.findOne({ where: { id: dto.property_id } });
        if (!property) throw new NotFoundException('Property not found');

        try {
            const componentData: any = {
                property_id: dto.property_id,
                project_id: dto.project_id || null,
                contractor_id: propertyProject.contractor_id || null,
                description: dto.description,
                install_date: dto.install_date,
                supplier: dto.supplier,
                installer: dto.installer,
                brand: brandName,
                other_brand: otherBrandName,
                manufacturer: dto.manufacturer || null,
                where_install: dto.where_install || null,
                material: dto.material || null,
                production_line: dto.production_line,
                order_number: dto.order_number,
                u_factor: dto.u_factor || null,
            };

            const component = this.windowsRepository.create(componentData);
            const savedComponent = await this.windowsRepository.save(component as any);
            return await this.transformComponentResponse(savedComponent);
        } catch (error: any) {
            if (error.message?.includes('foreign key constraint')) {
                throw new BadRequestException({
                    message: 'Cannot add windows component. The property may not exist or a report has already been generated for this property.',
                    error: 'INVALID_PROPERTY_OR_REPORT_EXISTS',
                    componentType: 'WINDOWS',
                    propertyId: dto.property_id,
                });
            }
            if (error.message?.includes('duplicate key value') || error.message?.includes('brands_brand_name_key')) {
                throw new BadRequestException({
                    message: `Cannot add windows component. The brand '${dto.other_brand || dto.brand_id}' already exists.`,
                    error: 'DUPLICATE_BRAND_NAME',
                    componentType: 'WINDOWS',
                    propertyId: dto.property_id,
                    existingBrandName: dto.other_brand?.trim() || undefined,
                });
            }
            throw error;
        }
    }

    async updateWindows(componentId: string, dto: Partial<WindowsDto>, userId: string, userRole: string): Promise<Windows> {
        const existingWindows = await this.windowsRepository.findOne({ where: { id: componentId } });
        if (!existingWindows) {
            throw new NotFoundException(`Windows component with ID ${componentId} not found`);
        }

        const canModifyResult = await this.canModifyComponent(existingWindows.property_id, userId, userRole);
        if (!canModifyResult.canModify) {
            throw new BadRequestException({
                message: canModifyResult.reason,
                error: 'REPORT_ALREADY_GENERATED',
                reportId: canModifyResult.reportId,
                componentType: 'WINDOWS',
                propertyId: existingWindows.property_id,
            });
        }

        const updateData: any = { ...dto };
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.WINDOWS]);
            updateData.brand = brand.name;
            delete updateData.brand_id;
        }

        if ('project_id' in dto) {
            updateData.contractor_id = await this.resolveProjectContractorId(dto.project_id ?? null, existingWindows.property_id);
        }

        await this.windowsRepository.update(componentId, updateData);
        const updatedComponent = await this.windowsRepository.findOne({ where: { id: componentId } }) as Windows;
        return await this.transformComponentResponse(updatedComponent);
    }

    async saveDoors(dto: DoorsDto, userId: string, userRole: string): Promise<Doors> {
        // Validate property project exists and matches component type
        const propertyProject = await this.validatePropertyProject(dto.property_id!, 'DOORS', userId, dto.project_id);

        // Resolve brand name and other_brand
        const { brandName, otherBrandName } = await this.resolveBrandForComponent(dto.brand_id, dto.other_brand, 'DOORS');

        // Validate property ownership
        const property = await this.propertyRepository.findOne({ where: { id: dto.property_id } });
        if (!property) throw new NotFoundException('Property not found');

        try {
            const componentData: any = {
                property_id: dto.property_id,
                project_id: dto.project_id || null,
                contractor_id: propertyProject.contractor_id || null,
                description: dto.description,
                install_date: dto.install_date,
                supplier: dto.supplier,
                installer: dto.installer,
                brand: brandName,
                other_brand: otherBrandName,
                manufacturer: dto.manufacturer || null,
                where_install: dto.where_install || null,
                material: dto.material || null,
                door_code: dto.door_code || null,
                production_line: dto.production_line,
                order_number: dto.order_number,
            };

            const component = this.doorsRepository.create(componentData);
            const savedComponent = await this.doorsRepository.save(component as any);
            return await this.transformComponentResponse(savedComponent);
        } catch (error: any) {
            if (error.message?.includes('foreign key constraint')) {
                throw new BadRequestException({
                    message: 'Cannot add doors component. The property may not exist or a report has already been generated for this property.',
                    error: 'INVALID_PROPERTY_OR_REPORT_EXISTS',
                    componentType: 'DOORS',
                    propertyId: dto.property_id,
                });
            }
            if (error.message?.includes('duplicate key value') || error.message?.includes('brands_brand_name_key')) {
                throw new BadRequestException({
                    message: `Cannot add doors component. The brand '${dto.other_brand || dto.brand_id}' already exists.`,
                    error: 'DUPLICATE_BRAND_NAME',
                    componentType: 'DOORS',
                    propertyId: dto.property_id,
                    existingBrandName: dto.other_brand?.trim() || undefined,
                });
            }
            throw error;
        }
    }

    async updateDoors(componentId: string, dto: Partial<DoorsDto>, userId: string, userRole: string): Promise<Doors> {
        const existingDoors = await this.doorsRepository.findOne({ where: { id: componentId } });
        if (!existingDoors) {
            throw new NotFoundException(`Doors component with ID ${componentId} not found`);
        }

        const canModifyResult = await this.canModifyComponent(existingDoors.property_id, userId, userRole);
        if (!canModifyResult.canModify) {
            throw new BadRequestException({
                message: canModifyResult.reason,
                error: 'REPORT_ALREADY_GENERATED',
                reportId: canModifyResult.reportId,
                componentType: 'DOORS',
                propertyId: existingDoors.property_id,
            });
        }

        const updateData: any = { ...dto };
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.DOORS]);
            updateData.brand = brand.name;
            delete updateData.brand_id;
        }

        if ('project_id' in dto) {
            updateData.contractor_id = await this.resolveProjectContractorId(dto.project_id ?? null, existingDoors.property_id);
        }

        await this.doorsRepository.update(componentId, updateData);
        const updatedComponent = await this.doorsRepository.findOne({ where: { id: componentId } }) as Doors;
        return await this.transformComponentResponse(updatedComponent);
    }

    // Admin-only methods — clone + insert new version instead of UPDATE
    async adminUpdateRoofing(componentId: string, dto: Partial<RoofingDto>, adminUserId: string, adminRole: string): Promise<Roofing> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify components after report generation');
        }

        const existing = await this.roofingRepository.findOne({ where: { id: componentId, isLatest: true } as any });
        if (!existing) {
            throw new NotFoundException(`Roofing component with ID ${componentId} not found`);
        }

        // Validate brand if provided
        let brandName = existing.brand;
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.ROOFING]);
            brandName = brand.name;
        }

        // If project_id is being updated, validate it exists
        if (dto.project_id && dto.project_id !== existing.project_id) {
            const projectExists = await this.propertyProjectRepository.findOne({
                where: { id: dto.project_id, property_id: existing.property_id }
            });
            if (!projectExists) {
                throw new BadRequestException(`Project with ID ${dto.project_id} not found for this property`);
            }
        }

        // Step 1 — mark old row as not latest
        await this.roofingRepository.update(componentId, { isLatest: false } as any);

        // Step 2 — clone with updated fields
        const { id, created_at, updated_at, version, rootId, isLatest, ...rest } = existing as any;
        const newRow = this.roofingRepository.create({
            ...rest,
            ...dto,
            brand: brandName,
            brand_id: undefined,
            project_id: dto.project_id || existing.project_id,
            contractor_id: dto.project_id !== undefined && dto.project_id !== existing.project_id
                ? await this.resolveProjectContractorId(dto.project_id, existing.property_id)
                : existing.contractor_id,
            version: (existing.version ?? 1) + 1,
            rootId: existing.rootId ?? existing.id,
            isLatest: true,
            report_id: existing.report_id,
        } as any);
        const saved = await this.roofingRepository.save(newRow as any) as Roofing;
        return await this.transformComponentResponse(saved);
    }

    async adminUpdateSiding(componentId: string, dto: Partial<SidingDto>, adminUserId: string, adminRole: string): Promise<Siding> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify components after report generation');
        }

        const existing = await this.sidingRepository.findOne({ where: { id: componentId, isLatest: true } as any });
        if (!existing) {
            throw new NotFoundException(`Siding component with ID ${componentId} not found`);
        }

        let brandName = existing.brand;
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.SIDING]);
            brandName = brand.name;
        }

        // If project_id is being updated, validate it exists
        if (dto.project_id && dto.project_id !== existing.project_id) {
            const projectExists = await this.propertyProjectRepository.findOne({
                where: { id: dto.project_id, property_id: existing.property_id }
            });
            if (!projectExists) {
                throw new BadRequestException(`Project with ID ${dto.project_id} not found for this property`);
            }
        }

        await this.sidingRepository.update(componentId, { isLatest: false } as any);

        const { id, created_at, updated_at, version, rootId, isLatest, ...rest } = existing as any;
        const newRow = this.sidingRepository.create({
            ...rest,
            ...dto,
            brand: brandName,
            brand_id: undefined,
            project_id: dto.project_id || existing.project_id,
            contractor_id: dto.project_id !== undefined && dto.project_id !== existing.project_id
                ? await this.resolveProjectContractorId(dto.project_id, existing.property_id)
                : existing.contractor_id,
            version: (existing.version ?? 1) + 1,
            rootId: existing.rootId ?? existing.id,
            isLatest: true,
            report_id: existing.report_id,
        } as any);
        const saved = await this.sidingRepository.save(newRow as any) as Siding;
        return await this.transformComponentResponse(saved);
    }

    async adminUpdateWindows(componentId: string, dto: Partial<WindowsDto>, adminUserId: string, adminRole: string): Promise<Windows> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify components after report generation');
        }

        const existing = await this.windowsRepository.findOne({ where: { id: componentId, isLatest: true } as any });
        if (!existing) {
            throw new NotFoundException(`Windows component with ID ${componentId} not found`);
        }

        let brandName = existing.brand;
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.WINDOWS]);
            brandName = brand.name;
        }

        // If project_id is being updated, validate it exists
        if (dto.project_id && dto.project_id !== existing.project_id) {
            const projectExists = await this.propertyProjectRepository.findOne({
                where: { id: dto.project_id, property_id: existing.property_id }
            });
            if (!projectExists) {
                throw new BadRequestException(`Project with ID ${dto.project_id} not found for this property`);
            }
        }

        await this.windowsRepository.update(componentId, { isLatest: false } as any);

        const { id, created_at, updated_at, version, rootId, isLatest, ...rest } = existing as any;
        const newRow = this.windowsRepository.create({
            ...rest,
            ...dto,
            brand: brandName,
            brand_id: undefined,
            project_id: dto.project_id || existing.project_id,
            contractor_id: dto.project_id !== undefined && dto.project_id !== existing.project_id
                ? await this.resolveProjectContractorId(dto.project_id, existing.property_id)
                : existing.contractor_id,
            version: (existing.version ?? 1) + 1,
            rootId: existing.rootId ?? existing.id,
            isLatest: true,
            report_id: existing.report_id,
        } as any);
        const saved = await this.windowsRepository.save(newRow as any) as Windows;
        return await this.transformComponentResponse(saved);
    }

    async adminUpdateDoors(componentId: string, dto: Partial<DoorsDto>, adminUserId: string, adminRole: string): Promise<Doors> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify components after report generation');
        }

        const existing = await this.doorsRepository.findOne({ where: { id: componentId, isLatest: true } as any });
        if (!existing) {
            throw new NotFoundException(`Doors component with ID ${componentId} not found`);
        }

        let brandName = existing.brand;
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.DOORS]);
            brandName = brand.name;
        }

        // If project_id is being updated, validate it exists
        if (dto.project_id && dto.project_id !== existing.project_id) {
            const projectExists = await this.propertyProjectRepository.findOne({
                where: { id: dto.project_id, property_id: existing.property_id }
            });
            if (!projectExists) {
                throw new BadRequestException(`Project with ID ${dto.project_id} not found for this property`);
            }
        }

        await this.doorsRepository.update(componentId, { isLatest: false } as any);

        const { id, created_at, updated_at, version, rootId, isLatest, ...rest } = existing as any;
        const newRow = this.doorsRepository.create({
            ...rest,
            ...dto,
            brand: brandName,
            brand_id: undefined,
            project_id: dto.project_id || existing.project_id,
            contractor_id: dto.project_id !== undefined && dto.project_id !== existing.project_id
                ? await this.resolveProjectContractorId(dto.project_id, existing.property_id)
                : existing.contractor_id,
            version: (existing.version ?? 1) + 1,
            rootId: existing.rootId ?? existing.id,
            isLatest: true,
            report_id: existing.report_id,
        } as any);
        const saved = await this.doorsRepository.save(newRow as any) as Doors;
        return await this.transformComponentResponse(saved);
    }

    async adminDeleteComponent(componentId: string, adminUserId: string, adminRole: string): Promise<void> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can delete components');
        }

        // Try owner project details first, then homeowner project and contractor component tables.
        const ownerProject = await this.ownerProjectRepository.findOne({ where: { id: componentId } });
        if (ownerProject) {
            await this.ownerProjectRepository.remove(ownerProject);
            return;
        }

        const homeownerProjectTypes = [
            ProjectType.NEW_CABINETS,
            ProjectType.NEW_APPLIANCES,
            ProjectType.NEW_FURNACE,
            ProjectType.NEW_AC,
            ProjectType.ADDED_ROOM,
            ProjectType.NEW_YARD_WORK,
            ProjectType.OTHER,
        ];

        const propertyProject = await this.propertyProjectRepository.findOne({ where: { id: componentId } });
        if (propertyProject && homeownerProjectTypes.includes(propertyProject.project_type)) {
            await this.propertyProjectRepository.remove(propertyProject);
            return;
        }

        // Try each contractor component table and remove if found
        const roofing = await this.roofingRepository.findOne({ where: { id: componentId } });
        if (roofing) {
            await this.roofingRepository.remove(roofing);
            return;
        }

        const siding = await this.sidingRepository.findOne({ where: { id: componentId } });
        if (siding) {
            await this.sidingRepository.remove(siding);
            return;
        }

        const windows = await this.windowsRepository.findOne({ where: { id: componentId } });
        if (windows) {
            await this.windowsRepository.remove(windows);
            return;
        }

        const doors = await this.doorsRepository.findOne({ where: { id: componentId } });
        if (doors) {
            await this.doorsRepository.remove(doors);
            return;
        }

        const garage = await this.garageDoorsRepository.findOne({ where: { id: componentId } });
        if (garage) {
            await this.garageDoorsRepository.remove(garage);
            return;
        }

        throw new NotFoundException(`Component with ID ${componentId} not found`);
    }

    async adminDeleteImage(imageId: string, adminUserId: string, adminRole: string): Promise<void> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can delete images');
        }

        await this.reportsService.deleteImage(imageId);
    }

    async getReportStatus(propertyId: string): Promise<{ hasReport: boolean; isImmutable: boolean; reportId?: string; reportType?: string }> {
        const report = await this.reportRepository.findOne({
            where: { property_id: propertyId }
        });

        return {
            hasReport: !!report,
            isImmutable: report?.immutable || false,
            reportId: report?.id,
            reportType: report?.report_type
        };
    }

    async getWindowsComponent(componentId: string): Promise<Windows> {
        const component = await this.windowsRepository.findOne({ where: { id: componentId } });
        if (!component) {
            throw new NotFoundException(`Windows component with ID ${componentId} not found`);
        }
        return component;
    }

    async getDoorsComponent(componentId: string): Promise<Doors> {
        const component = await this.doorsRepository.findOne({ where: { id: componentId } });
        if (!component) {
            throw new NotFoundException(`Doors component with ID ${componentId} not found`);
        }
        return component;
    }

    async getGarageDoorsComponent(componentId: string): Promise<GarageDoors> {
        const component = await this.garageDoorsRepository.findOne({ where: { id: componentId } });
        if (!component) {
            throw new NotFoundException(`Garage Doors component with ID ${componentId} not found`);
        }
        return component;
    }

    async saveGarageDoors(dto: GarageDoorsDto, userId: string, userRole: string): Promise<GarageDoors> {
        const propertyProject = await this.validatePropertyProject(dto.property_id!, 'GARAGE_DOORS', userId, dto.project_id);

        const { brandName, otherBrandName } = await this.resolveBrandForComponent(dto.brand_id, dto.other_brand, 'GARAGE_DOORS');

        const property = await this.propertyRepository.findOne({ where: { id: dto.property_id } });
        if (!property) throw new NotFoundException('Property not found');

        try {
            const componentData: any = {
                property_id: dto.property_id,
                project_id: dto.project_id || null,
                contractor_id: propertyProject.contractor_id || null,
                description: dto.description,
                install_date: dto.install_date,
                supplier: dto.supplier,
                installer: dto.installer,
                brand: brandName || dto.brand || null,
                other_brand: otherBrandName,
                manufacturer: dto.manufacturer || null,
                where_install: dto.where_install || null,
                order_number: dto.order_number || null,
                windcode: dto.windcode || null,
            };

            const component = this.garageDoorsRepository.create(componentData);
            const savedComponent = await this.garageDoorsRepository.save(component as any);
            return await this.transformComponentResponse(savedComponent);
        } catch (error: any) {
            if (error.message?.includes('foreign key constraint')) {
                throw new BadRequestException({
                    message: 'Cannot add garage doors component. The property may not exist or a report has already been generated for this property.',
                    error: 'INVALID_PROPERTY_OR_REPORT_EXISTS',
                    componentType: 'GARAGE_DOORS',
                    propertyId: dto.property_id,
                });
            }
            throw error;
        }
    }

    async updateGarageDoors(componentId: string, dto: Partial<GarageDoorsDto>, userId: string, userRole: string): Promise<GarageDoors> {
        const existing = await this.garageDoorsRepository.findOne({ where: { id: componentId } });
        if (!existing) {
            throw new NotFoundException(`Garage Doors component with ID ${componentId} not found`);
        }

        const canModifyResult = await this.canModifyComponent(existing.property_id, userId, userRole);
        if (!canModifyResult.canModify) {
            throw new BadRequestException({
                message: canModifyResult.reason,
                error: 'REPORT_ALREADY_GENERATED',
                reportId: canModifyResult.reportId,
                componentType: 'GARAGE_DOORS',
                propertyId: existing.property_id,
            });
        }

        const updateData: any = { ...dto };
        delete updateData.material;
        if (dto.brand_id) {
            const brand = await this.validateBrandById(dto.brand_id, [BrandCategory.GARAGE_DOORS]);
            updateData.brand_id = brand.id;
            delete updateData.brand_id; // keep brand_id column on entity
        }

        if ('project_id' in dto) {
            updateData.contractor_id = await this.resolveProjectContractorId(dto.project_id ?? null, existing.property_id);
        }

        await this.garageDoorsRepository.update(componentId, updateData);
        const updatedComponent = await this.garageDoorsRepository.findOne({ where: { id: componentId } }) as GarageDoors;
        return await this.transformComponentResponse(updatedComponent);
    }

    async adminUpdateGarageDoors(componentId: string, dto: Partial<GarageDoorsDto>, adminUserId: string, adminRole: string): Promise<GarageDoors> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify components after report generation');
        }

        const existing = await this.garageDoorsRepository.findOne({ where: { id: componentId, isLatest: true } as any });
        if (!existing) {
            throw new NotFoundException(`Garage Doors component with ID ${componentId} not found`);
        }

        const sanitizedDto: any = { ...dto };
        delete sanitizedDto.material;

        // If project_id is being updated, validate it exists
        if (dto.project_id && dto.project_id !== existing.project_id) {
            const projectExists = await this.propertyProjectRepository.findOne({
                where: { id: dto.project_id, property_id: existing.property_id }
            });
            if (!projectExists) {
                throw new BadRequestException(`Project with ID ${dto.project_id} not found for this property`);
            }
        }

        await this.garageDoorsRepository.update(componentId, { isLatest: false } as any);

        const { id, created_at, updated_at, version, rootId, isLatest, ...rest } = existing as any;
        const newRow = this.garageDoorsRepository.create({
            ...rest,
            ...sanitizedDto,
            project_id: dto.project_id || existing.project_id,
            contractor_id: dto.project_id !== undefined && dto.project_id !== existing.project_id
                ? await this.resolveProjectContractorId(dto.project_id, existing.property_id)
                : existing.contractor_id,
            brand_id: dto.brand_id ?? existing.brand_id,
            version: (existing.version ?? 1) + 1,
            rootId: existing.rootId ?? existing.id,
            isLatest: true,
            report_id: existing.report_id,
        } as any);
        const saved = await this.garageDoorsRepository.save(newRow as any) as GarageDoors;
        return await this.transformComponentResponse(saved);
    }

    async adminUpdateComponentImages(componentId: string, componentType: string, files: any[], adminUserId: string, adminRole: string): Promise<any[]> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify component images');
        }

        // Prepare component for admin update (preserves property owner images)
        await this.reportsService.prepareComponentForAdminContractorImageUpdate(componentId);

        // Upload new contractor images
        const newImages = await this.reportsService.adminUploadComponentImages(componentId, componentType, files);

        return newImages;
    }
}