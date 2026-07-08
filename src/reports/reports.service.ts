import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Report } from '../entities/report.entity';
import { ReportImage } from '../entities/report-image.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { Property } from '../entities/property.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { CreateReportsDto } from './dto/create-reports.dto';
import { UserRole } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Report)
        private reportRepository: Repository<Report>,
        @InjectRepository(ReportImage)
        private reportImageRepository: Repository<ReportImage>,
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
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>,
        @InjectRepository(PropertyProject)
        private propertyProjectRepository: Repository<PropertyProject>,
        @InjectRepository(OwnerProject)
        private ownerProjectRepository: Repository<OwnerProject>,
        private readonly notificationsService: NotificationsService,
    ) { }

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    private sanitizeUser(user: any): any {
        if (!user) return null;
        return {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
        };
    }

    private sanitizePropertyType(propertyType: any): any {
        if (!propertyType) return null;
        return {
            id: propertyType.id,
            type_name: propertyType.type_name,
        };
    }

    async generateReport(propertyId: string, userId: string, userRole?: string): Promise<any> {
        // 1. Fetch Property and enforce ownership
        const property = await this.propertyRepository.findOne({
            where: { id: propertyId },
            relations: ['creator', 'city', 'property_owner', 'property_type']
        });
        if (!property) {
            throw new NotFoundException('Property not found');
        }
        if (property.created_by !== userId && property.property_owner_id !== userId && !this.isAdmin(userRole)) {
            throw new BadRequestException('You do not have permission to view reports for this property');
        }

        // Fetch homeowner projects for this property
        const ownerProjects = await this.ownerProjectRepository.find({
            where: { property_id: propertyId, is_latest: true },
            relations: ['project', 'brandEntity'],
            order: { created_at: 'DESC' }
        });

        // 2. Check what components exist for this property
        const roofing = await this.roofingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const siding = await this.sidingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const windows = await this.windowsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const doors = await this.doorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const garageDoors = await this.garageDoorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });

        // 3. Determine report type based on existing components or homeowner projects
        let reportType = '';
        if (roofing.length > 0) {
            reportType = 'ROOFING';
        } else if (siding.length > 0) {
            reportType = 'SIDING';
        } else if (windows.length > 0) {
            reportType = 'WINDOWS';
        } else if (doors.length > 0) {
            reportType = 'DOORS';
        } else if (garageDoors.length > 0) {
            reportType = 'GARAGE_DOORS';
        } else if (ownerProjects.length > 0) {
            // Determine report type based on the first homeowner project's type
            const firstProjType = ownerProjects[0].project?.project_type as string;
            if (['ROOFING', 'SIDING', 'WINDOWS', 'DOORS'].includes(firstProjType)) {
                reportType = firstProjType;
            } else {
                reportType = 'ROOFING'; // fallback default
            }
        } else {
            throw new BadRequestException('No components or homeowner projects found for this property. Please add components or projects before generating a report.');
        }

        // 4. Check if report already exists for this property
        let existingReport = await this.reportRepository.findOne({
            where: { property_id: propertyId }
        });

        if (!existingReport) {
            // 5. Create new report with dynamic type and make it immutable
            const report = this.reportRepository.create({
                property_id: propertyId,
                report_type: reportType,
                created_by: userId,
                immutable: true  // Make immutable immediately after generation
            });
            existingReport = await this.reportRepository.save(report);

            // 6. Link ALL existing components to this report
            await this.linkAllComponentsToReport(propertyId, existingReport.id);
        }

        // 7. Update property has_report status to true when report is generated (for both new and existing reports)
        // Also generate unique_verification_id if not already set
        const updateData: any = { has_report: true };
        if (!property.unique_verification_id) {
            const { v4: uuidv4 } = await import('uuid');
            updateData.unique_verification_id = uuidv4();
        }
        await this.propertyRepository.update(propertyId, updateData);
        property.has_report = true;
        if (updateData.unique_verification_id) {
            property.unique_verification_id = updateData.unique_verification_id;
        }
        
        // Send notifications for report generation (only for new reports)
        if (!existingReport) {
            try {
                if (property.property_owner_id && property.city_id) {
                    await this.notificationsService.notifyReportGeneratedForProperty(
                        propertyId,
                        property.address || 'No address provided',
                        property.property_owner_id,
                        userId,
                        property.city_id
                    );
                }
            } catch (error) {
                console.error('Failed to send report generation notifications:', error);
            }
        }

        // Refetch/ensure we have the latest components and images
        const finalRoofing = await this.roofingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const finalSiding = await this.sidingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const finalWindows = await this.windowsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const finalDoors = await this.doorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const finalGarageDoors = await this.garageDoorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });

        // Fetch property projects for this property
        const propertyProjects = await this.propertyProjectRepository.find({
            where: { created_by: userId },
            relations: ['contractor', 'createdBy'],
            order: { created_at: 'DESC' }
        });

        // Resolve images for homeowner projects
        const ownerProjectIds = ownerProjects.map(op => op.id);
        let ownerImages: ReportImage[] = [];
        if (ownerProjectIds.length > 0) {
            ownerImages = await this.reportImageRepository.createQueryBuilder('image')
                .where('image.owner_project_id IN (:...ids)', { ids: ownerProjectIds })
                .getMany();
        }

        const ownerProjectsWithImages = ownerProjects.map(op => ({
            ...op,
            images: ownerImages.filter(img => img.owner_project_id === op.id)
        }));

        const allComponentIds = [
            ...finalRoofing.map(r => r.id),
            ...finalSiding.map(s => s.id),
            ...finalWindows.map(w => w.id),
            ...finalDoors.map(d => d.id),
            ...finalGarageDoors.map(g => g.id),
        ];
        let images: ReportImage[] = [];
        if (allComponentIds.length > 0) {
            images = await this.reportImageRepository.createQueryBuilder('image')
                .where('image.component_id IN (:...ids)', { ids: allComponentIds })
                .getMany();
        }

        // 7. Format components: return as object (not array) and hide if empty
        const components: any = {};
        if (finalRoofing.length > 0) {
            components.roofing = finalRoofing.map(roofing => ({
                ...roofing,
                images: images.filter(img => img.component_id === roofing.id)
            }));
        }
        if (finalSiding.length > 0) {
            components.siding = finalSiding.map(siding => ({
                ...siding,
                images: images.filter(img => img.component_id === siding.id)
            }));
        }
        if (finalWindows.length > 0) {
            components.windows = finalWindows.map(win => ({
                ...win,
                images: images.filter(img => img.component_id === win.id)
            }));
        }
        if (finalDoors.length > 0) {
            components.doors = finalDoors.map(door => ({
                ...door,
                images: images.filter(img => img.component_id === door.id)
            }));
        }
        if (finalGarageDoors.length > 0) {
            components.garage_doors = finalGarageDoors.map(gd => ({
                ...gd,
                images: images.filter(img => img.component_id === gd.id)
            }));
        }

        const sanitizedProperty = {
            ...property,
            city: undefined,
            state: undefined,
            property_type: this.sanitizePropertyType(property.property_type),
            creator: this.sanitizeUser(property.creator),
            property_owner: this.sanitizeUser(property.property_owner),
        };

        const sanitizedPropertyProjects = propertyProjects.map(project => ({
            ...project,
            contractor: this.sanitizeUser(project.contractor),
            createdBy: this.sanitizeUser(project.createdBy),
        }));

        const sanitizedOwnerProjects = ownerProjectsWithImages.map(op => ({
            ...op,
        }));

        return {
            property: sanitizedProperty,
            report: {
                id: existingReport.id,
                report_type: existingReport.report_type,
                immutable: existingReport.immutable,
                created_at: existingReport.created_at
            },
            unique_verification_id: property.unique_verification_id,
            property_projects: sanitizedPropertyProjects,
            owner_projects: sanitizedOwnerProjects,
            components
        };
    }

    private async linkAllComponentsToReport(propertyId: string, reportId: string): Promise<void> {
        // Link all components that don't have report_id yet
        await this.roofingRepository.update(
            { property_id: propertyId, report_id: IsNull() },
            { report_id: reportId }
        );
        await this.sidingRepository.update(
            { property_id: propertyId, report_id: IsNull() },
            { report_id: reportId }
        );
        await this.windowsRepository.update(
            { property_id: propertyId, report_id: IsNull() },
            { report_id: reportId }
        );
        await this.doorsRepository.update(
            { property_id: propertyId, report_id: IsNull() },
            { report_id: reportId }
        );
        await this.garageDoorsRepository.update(
            { property_id: propertyId, report_id: IsNull() },
            { report_id: reportId }
        );
    }

    async regenerateReport(propertyId: string, adminUserId: string, adminRole: string): Promise<any> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only admins can regenerate reports');
        }

        // 1. Verify property exists
        const property = await this.propertyRepository.findOne({ where: { id: propertyId } });
        if (!property) {
            throw new NotFoundException('Property not found');
        }

        // 2. Check components exist for this property
        const roofingBefore = await this.roofingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const sidingBefore = await this.sidingRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const windowsBefore = await this.windowsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const doorsBefore = await this.doorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });
        const garageDoorsBefore = await this.garageDoorsRepository.find({ where: { property_id: propertyId, isLatest: true } as any });

        if (roofingBefore.length === 0 && sidingBefore.length === 0 && windowsBefore.length === 0 && doorsBefore.length === 0 && garageDoorsBefore.length === 0) {
            throw new BadRequestException('No components found for this property. Cannot regenerate report without components.');
        }

        // 3. Delete existing report
        await this.reportRepository.delete({ property_id: propertyId });

        // 4. Clear report_id from all components
        await this.roofingRepository
            .createQueryBuilder()
            .update()
            .set({ report_id: null })
            .where('property_id = :propertyId', { propertyId })
            .execute();

        await this.sidingRepository
            .createQueryBuilder()
            .update()
            .set({ report_id: null })
            .where('property_id = :propertyId', { propertyId })
            .execute();

        await this.windowsRepository
            .createQueryBuilder()
            .update()
            .set({ report_id: null })
            .where('property_id = :propertyId', { propertyId })
            .execute();

        await this.doorsRepository
            .createQueryBuilder()
            .update()
            .set({ report_id: null })
            .where('property_id = :propertyId', { propertyId })
            .execute();

        await this.garageDoorsRepository
            .createQueryBuilder()
            .update()
            .set({ report_id: null })
            .where('property_id = :propertyId', { propertyId })
            .execute();

        // 5. Generate new report
        return await this.generateReport(propertyId, adminUserId, adminRole);
    }

    async checkImmutability(propertyId: string, componentType: string) {
        const report = await this.reportRepository.findOne({
            where: { property_id: propertyId }
        });
        if (report?.immutable) {
            throw new BadRequestException('Editing not allowed after report creation. Contact admin for modifications.');
        }
    }

    async findOne(id: string): Promise<any> {
        const report = await this.reportRepository.findOne({
            where: { id },
            relations: ['property', 'property.creator', 'property.city', 'property.property_owner'],
        });

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }

        // Fetch component data based on type
        let componentData: any = null;
        if (report.report_type === 'ROOFING') {
            componentData = await this.roofingRepository.findOne({ where: { report_id: id } });
        } else if (report.report_type === 'SIDING') {
            componentData = await this.sidingRepository.findOne({ where: { report_id: id } });
        } else if (report.report_type === 'WINDOWS') {
            componentData = await this.windowsRepository.find({ where: { report_id: id } });
        } else if (report.report_type === 'DOORS') {
            componentData = await this.doorsRepository.find({ where: { report_id: id } });
        } else if (report.report_type === 'GARAGE_DOORS') {
            componentData = await this.garageDoorsRepository.find({ where: { report_id: id } });
        }

        // Fetch images based on component ID
        let images: ReportImage[] = [];
        if (componentData) {
            const componentId = Array.isArray(componentData) ? componentData[0]?.id : componentData.id;
            if (componentId) {
                images = await this.reportImageRepository.find({
                    where: { component_id: componentId },
                    order: { created_at: 'ASC' }
                });
            }
        }

        return {
            ...report,
            component_data: componentData,
            images,
            pdf_url: null, // Placeholder for future PDF generation
        };
    }

    async uploadComponentImages(componentId: string, componentType: string, files: any[], userId: string, userRole: string): Promise<ReportImage[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded. Ensure you use the "files" field in your multipart/form-data request.');
        }

        // Find property_id from the component
        let propertyId: string;
        let propertyCreatedBy: string;
        let compProject: any;

        if (componentType === 'ROOFING') {
            const comp = await this.roofingRepository.findOne({ where: { id: componentId }, relations: ['property', 'project'] });
            if (!comp) throw new NotFoundException('Roofing component not found');
            propertyId = comp.property_id;
            propertyCreatedBy = comp.property?.created_by || '';
            compProject = comp.project;
        } else if (componentType === 'SIDING') {
            const comp = await this.sidingRepository.findOne({ where: { id: componentId }, relations: ['property', 'project'] });
            if (!comp) throw new NotFoundException('Siding component not found');
            propertyId = comp.property_id;
            propertyCreatedBy = comp.property?.created_by || '';
            compProject = comp.project;
        } else if (componentType === 'WINDOWS') {
            const comp = await this.windowsRepository.findOne({ where: { id: componentId }, relations: ['property', 'project'] });
            if (!comp) throw new NotFoundException('Windows component not found');
            propertyId = comp.property_id;
            propertyCreatedBy = comp.property?.created_by || '';
            compProject = comp.project;
        } else if (componentType === 'GARAGE_DOORS') {
            const comp = await this.garageDoorsRepository.findOne({ where: { id: componentId }, relations: ['property', 'project'] });
            if (!comp) throw new NotFoundException('Garage Doors component not found');
            propertyId = comp.property_id;
            propertyCreatedBy = comp.property?.created_by || '';
            compProject = comp.project;
        } else {
            const comp = await this.doorsRepository.findOne({ where: { id: componentId }, relations: ['property', 'project'] });
            if (!comp) throw new NotFoundException('Doors component not found');
            propertyId = comp.property_id;
            propertyCreatedBy = comp.property?.created_by || '';
            compProject = comp.project;
        }

        const isProjectContractor = compProject && (compProject.created_by === userId || compProject.contractor_id === userId);

        // Enforce ownership: only the contractor who created the property OR the contractor associated with the component's project can upload images
        if (propertyCreatedBy !== userId && !isProjectContractor && !this.isAdmin(userRole)) {
            throw new ForbiddenException('You do not have permission to upload images for this component');
        }

        // Check if report is already generated and immutable
        await this.checkImmutability(propertyId, componentType);

        const year = new Date().getFullYear().toString();

        // 1. Create directory structure: uploads/property_id/component/year/
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, componentType.toLowerCase(), year);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const savedImages: ReportImage[] = [];

        for (const file of files) {
            const fileExt = path.extname(file.originalname);
            const fileName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, file.buffer);

            // 2. Save relative URL for database
            const imageUrl = `/uploads/${propertyId}/${componentType.toLowerCase()}/${year}/${fileName}`;

            const reportImage = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                component_type: componentType,
                image_category: (file as any).fieldname || null,
            } as any);

            const saved = await this.reportImageRepository.save(reportImage as any) as ReportImage;
            savedImages.push(saved);
        }

        return savedImages;
    }

    async adminUploadComponentImages(componentId: string, componentType: string, files: any[]): Promise<any[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded. Ensure you use the "files" field in your multipart/form-data request.');
        }

        // Find property_id from the component (admin bypass - no immutability check)
        let propertyId: string;

        if (componentType === 'ROOFING') {
            const comp = await this.roofingRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Roofing component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'SIDING') {
            const comp = await this.sidingRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Siding component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'WINDOWS') {
            const comp = await this.windowsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Windows component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'DOORS') {
            const comp = await this.doorsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Doors component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'GARAGE_DOORS') {
            const comp = await this.garageDoorsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Garage Doors component not found');
            propertyId = comp.property_id;
        } else {
            throw new BadRequestException(`Unsupported component type: ${componentType}`);
        }

        // Skip immutability check for admin
        const year = new Date().getFullYear().toString();

        // Create directory structure: uploads/property_id/component/year/
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, componentType.toLowerCase(), year);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const savedImages: any[] = [];

        for (const file of files) {
            const fileExt = path.extname(file.originalname);
            const fileName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, file.buffer);

            // Save relative URL for database
            const imageUrl = `/uploads/${propertyId}/${componentType.toLowerCase()}/${year}/${fileName}`;

            const reportImage = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                component_type: componentType,
                image_category: (file as any).fieldname || null,
            } as any);

            const saved = await this.reportImageRepository.save(reportImage as any);
            savedImages.push(saved);
        }

        return savedImages;
    }

    async deleteComponentImages(componentId: string): Promise<void> {
        // Find all images for this component
        const images = await this.reportImageRepository.find({
            where: { component_id: componentId }
        });

        // Delete image files from filesystem
        for (const image of images) {
            if (image.image_url) {
                const filePath = path.join(process.cwd(), image.image_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // Delete image records from database
        await this.reportImageRepository.delete({ component_id: componentId });
    }

    async deleteImage(imageId: string): Promise<void> {
        // Find the image
        const image = await this.reportImageRepository.findOne({ where: { id: imageId } });
        if (!image) {
            throw new NotFoundException(`Image with ID ${imageId} not found`);
        }

        // Delete image file from filesystem
        if (image.image_url) {
            const filePath = path.join(process.cwd(), image.image_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Delete image record from database
        await this.reportImageRepository.delete(imageId);
    }

    async prepareComponentForAdminContractorImageUpdate(componentId: string): Promise<void> {
        // 1. Fetch all images for this component
        const images = await this.reportImageRepository.find({
            where: { component_id: componentId }
        });

        // 2. Process each image
        for (const image of images) {
            if (image.owner_uploaded) {
                // If this record has an owner upload, keep the record but clear the contractor image
                if (image.image_url) {
                    const filePath = path.join(process.cwd(), image.image_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    image.image_url = null;
                    await this.reportImageRepository.save(image as any);
                }
            } else {
                // If it's only a contractor image, delete it entirely (file and record)
                if (image.image_url) {
                    const filePath = path.join(process.cwd(), image.image_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }
                await this.reportImageRepository.delete(image.id);
            }
        }
    }

    async uploadPropertyOwnerComponentImages(componentId: string, componentType: string, files: any[], ownerId: string): Promise<ReportImage[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded.');
        }

        // 1. Fetch component and verify ownership
        let propertyId: string;
        if (componentType === 'ROOFING') {
            const comp = await this.roofingRepository.findOne({ where: { id: componentId }, relations: ['property'] });
            if (!comp) throw new NotFoundException('Roofing component not found');
            if (comp.property.property_owner_id !== ownerId) throw new ForbiddenException('You do not have permission to upload images for this component');
            propertyId = comp.property_id;
        } else if (componentType === 'SIDING') {
            const comp = await this.sidingRepository.findOne({ where: { id: componentId }, relations: ['property'] });
            if (!comp) throw new NotFoundException('Siding component not found');
            if (comp.property.property_owner_id !== ownerId) throw new ForbiddenException('You do not have permission to upload images for this component');
            propertyId = comp.property_id;
        } else if (componentType === 'WINDOWS') {
            const comp = await this.windowsRepository.findOne({ where: { id: componentId }, relations: ['property'] });
            if (!comp) throw new NotFoundException('Windows component not found');
            if (comp.property.property_owner_id !== ownerId) throw new ForbiddenException('You do not have permission to upload images for this component');
            propertyId = comp.property_id;
        } else if (componentType === 'DOORS') {
            const comp = await this.doorsRepository.findOne({ where: { id: componentId }, relations: ['property'] });
            if (!comp) throw new NotFoundException('Doors component not found');
            if (comp.property.property_owner_id !== ownerId) throw new ForbiddenException('You do not have permission to upload images for this component');
            propertyId = comp.property_id;
        } else if (componentType === 'GARAGE_DOORS') {
            const comp = await this.garageDoorsRepository.findOne({ where: { id: componentId }, relations: ['property'] });
            if (!comp) throw new NotFoundException('Garage Doors component not found');
            if (comp.property.property_owner_id !== ownerId) throw new ForbiddenException('You do not have permission to upload images for this component');
            propertyId = comp.property_id;
        } else {
            throw new BadRequestException(`Unsupported component type: ${componentType}`);
        }

        // 2. Check if property owner has already uploaded images for this component
        const existingUpload = await this.reportImageRepository.findOne({
            where: { component_id: componentId, owner_uploaded: true }
        });

        if (existingUpload) {
            throw new ForbiddenException('You have already uploaded images for this component. Property owners can only upload images once per component.');
        }

        const year = new Date().getFullYear().toString();
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, componentType.toLowerCase(), year);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const savedImages: ReportImage[] = [];
        // Get existing contractor images for this component (ones without property owner files yet)
        const existingImages = await this.reportImageRepository.find({
            where: { component_id: componentId, property_owner_files: IsNull() },
            order: { created_at: 'ASC' }
        });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000000000)}${path.extname(file.originalname)}`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, file.buffer);

            const imageUrl = `/uploads/${propertyId}/${componentType.toLowerCase()}/${year}/${fileName}`;

            let saved: ReportImage;
            if (i < existingImages.length) {
                // Update existing record
                const existingImage = existingImages[i];
                existingImage.property_owner_files = imageUrl;
                existingImage.owner_uploaded = true;
                saved = await this.reportImageRepository.save(existingImage as any) as ReportImage;
            } else {
                // Create new record
                const reportImageData: any = {
                    component_id: componentId,
                    property_owner_files: imageUrl,
                    component_type: componentType,
                    owner_uploaded: true,
                    image_category: (file as any).fieldname || null,
                };
                const reportImage = this.reportImageRepository.create(reportImageData as any);
                saved = await this.reportImageRepository.save(reportImage as any) as ReportImage;
            }
            savedImages.push(saved);
        }

        return savedImages;
    }

    async adminEditPropertyOwnerImages(componentId: string, componentType: string, files: any[], adminUserId: string): Promise<ReportImage[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded.');
        }

        // 1. Verify component exists and get property ID
        let propertyId: string;
        if (componentType === 'ROOFING') {
            const comp = await this.roofingRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Roofing component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'SIDING') {
            const comp = await this.sidingRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Siding component not found');
            propertyId = comp.property_id;
        } else if (componentType === 'WINDOWS') {
            const comp = await this.windowsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Windows component not found');
            propertyId = comp.property_id;
        } else {
            const comp = await this.doorsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Doors component not found');
            propertyId = comp.property_id;
        }

        // 2. Check if property owner has uploaded images (owner_uploaded = true)
        const existingOwnerImages = await this.reportImageRepository.find({
            where: { component_id: componentId, owner_uploaded: true }
        });

        if (existingOwnerImages.length === 0) {
            throw new BadRequestException('No property owner images found for this component. Property owner must upload images first before admin can edit them.');
        }

        // 3. Delete old property owner image files and prepare records
        for (const image of existingOwnerImages) {
            if (image.property_owner_files) {
                const oldFilePath = path.join(process.cwd(), image.property_owner_files);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

            if (image.image_url) {
                // If it's a paired record, keep it but clear owner data
                image.property_owner_files = null;
                image.owner_uploaded = false;
                await this.reportImageRepository.save(image as any);
            } else {
                // If it's owner-only, delete the record
                await this.reportImageRepository.delete(image.id);
            }
        }

        const year = new Date().getFullYear().toString();
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, componentType.toLowerCase(), year);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const savedImages: ReportImage[] = [];

        // 5. Upload new property owner images
        for (const file of files) {
            const fileName = `admin_edit_${Date.now()}_${Math.floor(Math.random() * 1000000000)}${path.extname(file.originalname)}`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, file.buffer);

            const imageUrl = `/uploads/${propertyId}/${componentType.toLowerCase()}/${year}/${fileName}`;

            const reportImageData: any = {
                component_id: componentId,
                property_owner_files: imageUrl,
                component_type: componentType,
                owner_uploaded: true,
                image_category: (file as any).fieldname || null,
            };
            
            const reportImage = this.reportImageRepository.create(reportImageData);
            const saved = await this.reportImageRepository.save(reportImage);
            savedImages.push(saved as unknown as ReportImage);
        }

        return savedImages;
    }

    async getComponentImages(componentId: string): Promise<ReportImage[]> {
        return await this.reportImageRepository.find({
            where: { component_id: componentId },
            order: { created_at: 'ASC' }
        });
    }

    async deleteContractorImages(componentId: string): Promise<void> {
        // Find contractor images (owner_uploaded = false)
        const contractorImages = await this.reportImageRepository.find({
            where: { component_id: componentId, owner_uploaded: false }
        });

        // Delete contractor image files from filesystem
        for (const image of contractorImages) {
            if (image.image_url) {
                const filePath = path.join(process.cwd(), image.image_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // Delete contractor image records from database
        await this.reportImageRepository.delete({ 
            component_id: componentId, 
            owner_uploaded: false 
        });
    }

    async deleteImageFile(imageUrl: string): Promise<void> {
        const filePath = path.join(process.cwd(), imageUrl);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}
