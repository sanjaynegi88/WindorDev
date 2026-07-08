import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AwsS3Service } from '../common/services/aws-s3.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

import { CreateProjectPermitDto } from './dto/create-project-permit.dto';
import { VerifyProjectPermitDto } from './dto/verify-project-permit.dto';
import { ProjectPermit } from '../entities/project-permit.entity';
import { ProjectPermitStatus } from '../entities/project-permit.entity';
import { OwnerProject } from '../entities/owner-project.entity';
import { PropertyProject } from '../entities/property-project.entity';
import { Brand } from '../entities/brand.entity';
import { ReportImage } from '../entities/report-image.entity';
import { UserRole } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { User } from '../entities/user.entity';
import { SaveOwnerProjectDetailsDto } from './dto/save-owner-project-details.dto';

@Injectable()
export class OwnerProjectsService {
    constructor(
        @InjectRepository(OwnerProject)
        private readonly ownerProjectRepository: Repository<OwnerProject>,
        @InjectRepository(PropertyProject)
        private readonly propertyProjectRepository: Repository<PropertyProject>,
        @InjectRepository(Property)
        private readonly propertyRepository: Repository<Property>,
        @InjectRepository(Brand)
        private readonly brandRepository: Repository<Brand>,
        @InjectRepository(ReportImage)
        private readonly reportImageRepository: Repository<ReportImage>,
        private readonly awsS3Service: AwsS3Service
    ) {}

    // Save homeowner project details (owner-specific)
    async saveDetails(propertyId: string, dto: SaveOwnerProjectDetailsDto, userId: string): Promise<OwnerProject> {
        // Validate that the project type is a homeowner project type (NOT a contractor type)
        const contractorPredefined = ['ROOFING', 'SIDING', 'WINDOWS', 'DOORS', 'GARAGE_DOORS'];
        const projectId = dto.project_id;
        if (!projectId) {
            throw new BadRequestException('project_id must be provided in the request body');
        }

        // 1. Fetch high-level project
        const project = await this.propertyProjectRepository.findOne({ where: { id: projectId, property_id: propertyId } });
        if (!project) {
            throw new NotFoundException(`Property project with ID "${projectId}" not found for property "${propertyId}"`);
        }

        // 2. Ensure only the owner who created this project (or Admin) can modify it
        if (project.created_by !== userId) {
            throw new ForbiddenException(`You do not have permission to add details to this project`);
        }

        // Validate homeowner project type
        if (contractorPredefined.includes(project.project_type)) {
            throw new BadRequestException({
                message: `Cannot save homeowner details. The property project type is '${project.project_type}' which is a contractor project, not a homeowner project.`,
                error: 'INVALID_PROJECT_TYPE',
                projectType: project.project_type,
                solution: 'Please provide a valid homeowner project ID (e.g. NEW_CABINETS, NEW_APPLIANCES, etc.)',
            });
        }

        // 3. Create or Update Owner Specifications
        let details = await this.ownerProjectRepository.findOne({ where: { project_id: projectId } });
        if (!details) {
            details = this.ownerProjectRepository.create({
                project_id: projectId,
                property_id: propertyId,
            });
        }

        // Determine expected category based on project_type and other
        const expectedCategory = (project.project_type === 'OTHER' && project.other)
            ? project.other
            : project.project_type;

        // Save specifications (brand handling)
        if (dto.brand_id !== undefined || dto.other_brand !== undefined) {
            if (dto.brand_id) {
                const brand = await this.brandRepository.findOne({ where: { id: dto.brand_id } });
                if (!brand) {
                    throw new NotFoundException(`Brand with ID "${dto.brand_id}" not found`);
                }
                if (expectedCategory && brand.category.toLowerCase() !== expectedCategory.toLowerCase()) {
                    throw new BadRequestException({
                        message: `Invalid brand category. Selected brand belongs to category '${brand.category}' but this project category is '${expectedCategory}'.`,
                        error: 'BRAND_CATEGORY_MISMATCH',
                        brandCategory: brand.category,
                        expectedCategory: expectedCategory,
                    });
                }
                details.brand_id = brand.id;
                details.brand = brand.name;
                details.other_brand = null;
            } else if (dto.other_brand) {
                const trimmedOther = dto.other_brand.trim();
                if (trimmedOther && expectedCategory) {
                    let brand = await this.brandRepository.createQueryBuilder('brand')
                        .where('LOWER(brand.name) = LOWER(:name)', { name: trimmedOther })
                        .andWhere('LOWER(brand.category) = LOWER(:category)', { category: expectedCategory })
                        .getOne();
                    if (!brand) {
                        brand = this.brandRepository.create({ name: trimmedOther, category: expectedCategory });
                        await this.brandRepository.save(brand);
                    }
                    details.brand_id = brand.id;
                    details.brand = brand.name;
                    details.other_brand = trimmedOther;
                } else {
                    details.brand_id = null;
                    details.brand = null;
                    details.other_brand = null;
                }
            } else {
                details.brand_id = null;
                details.brand = null;
                details.other_brand = null;
            }
        }

        details.installer = dto.installer !== undefined ? dto.installer : details.installer;
        details.supplier = dto.supplier !== undefined ? dto.supplier : details.supplier;
        details.description = dto.description !== undefined ? dto.description : details.description;
        details.install_date = dto.install_date !== undefined ? (dto.install_date ? new Date(dto.install_date) : null) : details.install_date;

        return await this.ownerProjectRepository.save(details);
    }

    // New method to add a project permit
async addPermit(projectId: string, dto: CreateProjectPermitDto, file: Express.Multer.File, userId: string, userRole: string): Promise<ProjectPermit> {
        if (!file) {
            throw new BadRequestException('No file uploaded. Please provide a permit file using the "file" field.');
        }

        // Validate project existence and ownership
        const propertyProject = await this.propertyProjectRepository.findOne({ where: { id: projectId } });
        if (!propertyProject) {
            throw new NotFoundException(`Project with ID "${projectId}" not found`);
        }
        // Check if permit is required for this project
        if (propertyProject.need_permit === false) {
            throw new BadRequestException('You do not have to upload a permit for this project');
        }

        // Fetch the corresponding component details based on project type
        let componentDetails: any;
        let repositoryToUse: any;
        const manager = this.propertyProjectRepository.manager;

        if (propertyProject.project_type === 'ROOFING') {
            repositoryToUse = manager.getRepository('roofing');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId, isLatest: true } });
        } else if (propertyProject.project_type === 'SIDING') {
            repositoryToUse = manager.getRepository('siding');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId, isLatest: true } });
        } else if (propertyProject.project_type === 'WINDOWS') {
            repositoryToUse = manager.getRepository('windows');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId, isLatest: true } });
        } else if (propertyProject.project_type === 'DOORS') {
            repositoryToUse = manager.getRepository('doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId, isLatest: true } });
        } else if (propertyProject.project_type === 'GARAGE_DOORS') {
            repositoryToUse = manager.getRepository('garage_doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId, isLatest: true } });
        } else {
            repositoryToUse = this.ownerProjectRepository;
            componentDetails = await repositoryToUse.findOne({ where: { project_id: projectId } });
        }

        if (!componentDetails) {
            throw new NotFoundException(`Project details for project ID "${projectId}" not found.`);
        }

        // Allow upload if the requester is the property owner, an ADMIN, or a CITY_INSPECTOR within the same city
        const property = await this.propertyRepository.findOne({ where: { id: propertyProject.property_id } });
        if (!property) {
            throw new NotFoundException(`Property with ID "${propertyProject.property_id}" not found`);
        }

        const isOwner = property.property_owner_id === userId || propertyProject.created_by === userId;
        const isAdmin = userRole === 'ADMIN';
        const isInspector = userRole === 'CITY_INSPECTOR';
        if (!isOwner && !isAdmin && !isInspector) {
            throw new ForbiddenException('Only the property owner, admin, or city inspector can add a permit');
        }
        // If the user is a city inspector, ensure they belong to the same city as the property
        if (isInspector) {
            const inspector = await manager.findOne(User, { where: { id: userId } });
            if (inspector && property && inspector.city_id !== property.city_id) {
                throw new BadRequestException('Inspector does not belong to the same city as the property');
            }
        }

        // Derive uploader role from authenticated user role
        const uploaderRole = userRole === UserRole.CITY_INSPECTOR ? 'INSPECTOR' : 'PROPERTY_OWNER';

        // Store file
        const filePath = await this.savePermitFile(propertyProject.property_id, projectId, file);

        // Create permit record – FK points to PropertyProject.id
        const permit = manager.create(ProjectPermit, {
            project_id: projectId, // FK to property_project.id
            property_id: propertyProject.property_id,
            uploaded_by: userId,
            uploader_role: uploaderRole,
            file_path: filePath,
            status: ProjectPermitStatus.PENDING_VERIFICATION,
            description: dto.description,
            notes: (dto as any).notes,
        } as any);
        const savedPermit = await manager.save(permit);

        // Sync the new permit status to the parent project
        componentDetails.permit_status = savedPermit.status;
        componentDetails.permit_uploaded_at = savedPermit.uploaded_at || new Date();
        await repositoryToUse.save(componentDetails);

        return savedPermit;
    }



    // Helper to store file locally or to S3
    private async savePermitFile(propertyId: string, projectId: string, file: Express.Multer.File): Promise<string> {
        const year = new Date().getFullYear().toString();
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, 'project-permits', projectId, year);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const ext = path.extname(file.originalname);
        const fileName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, file.buffer);
        return `/uploads/${propertyId}/project-permits/${projectId}/${year}/${fileName}`;
    }

    // Verify a permit (inspector or admin)
    async verifyPermit(permitId: string, dto: VerifyProjectPermitDto, userId: string, userRole: string): Promise<ProjectPermit> {
        const manager = this.ownerProjectRepository.manager;

        // 1️⃣ Find the permit record
        const permit = await manager.findOne(ProjectPermit, { where: { id: permitId } });
        if (!permit) {
            throw new NotFoundException(`Permit with ID "${permitId}" not found`);
        }

        // 2️⃣ Only CITY_INSPECTOR or ADMIN may verify
        if (userRole !== 'CITY_INSPECTOR' && userRole !== 'ADMIN') {
            throw new ForbiddenException('Only a city inspector or admin can verify permits');
        }

        // 3️⃣ Resolve the PropertyProject (the FK stored in permit.project_id)
        const propertyProject = await this.propertyProjectRepository.findOne({ where: { id: permit.project_id } });
        if (!propertyProject) {
            throw new NotFoundException('Associated PropertyProject not found');
        }

        // 4️⃣ Resolve the Property linked to the PropertyProject
        const property = await manager.findOne(Property, { where: { id: propertyProject.property_id } });
        if (!property) {
            throw new NotFoundException('Associated Property not found');
        }

        // 5️⃣ Ensure the inspector belongs to the same city as the property (admin bypasses city check)
        if (userRole === 'CITY_INSPECTOR') {
            const inspector = await manager.findOne(User, { where: { id: userId } });
            if (inspector && (inspector as any).city_id && (property as any).city_id && (inspector as any).city_id !== (property as any).city_id) {
                throw new BadRequestException('Inspector does not belong to the same city as the property');
            }
        }

        // 6️⃣ Apply the status update
        permit.status = dto.status as ProjectPermitStatus;
        permit.verified_by = userId;
        permit.verified_at = new Date();
        const savedPermit = await manager.save(permit);

        // 7️⃣ Sync the verified status to the parent project
        let componentDetails: any;
        let repositoryToUse: any;

        if (propertyProject.project_type === 'ROOFING') {
            repositoryToUse = manager.getRepository('roofing');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'SIDING') {
            repositoryToUse = manager.getRepository('siding');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'WINDOWS') {
            repositoryToUse = manager.getRepository('windows');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'DOORS') {
            repositoryToUse = manager.getRepository('doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'GARAGE_DOORS') {
            repositoryToUse = manager.getRepository('garage_doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else {
            repositoryToUse = this.ownerProjectRepository;
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id } });
        }

        if (componentDetails) {
            componentDetails.permit_status = savedPermit.status;
            await repositoryToUse.save(componentDetails);
        }

        return savedPermit;
    }

    // Get permits for a project
    async getPermits(projectId: string): Promise<ProjectPermit[]> {
        return await this.ownerProjectRepository.manager.find(ProjectPermit, { where: { project_id: projectId } });
    }

    // Verify a project by project ID (with or without permit)
    async verifyProjectByProjectId(projectId: string, dto: VerifyProjectPermitDto, userId: string, userRole: string): Promise<any> {
        const manager = this.ownerProjectRepository.manager;

        // 1️⃣ Find the PropertyProject
        const propertyProject = await this.propertyProjectRepository.findOne({ where: { id: projectId } });
        if (!propertyProject) {
            throw new NotFoundException(`Project with ID "${projectId}" not found`);
        }

        // 2️⃣ Only CITY_INSPECTOR or ADMIN may verify
        if (userRole !== 'CITY_INSPECTOR' && userRole !== 'ADMIN') {
            throw new ForbiddenException('Only a city inspector or admin can verify projects');
        }

        // 3️⃣ Resolve the Property linked to the PropertyProject
        const property = await manager.findOne(Property, { where: { id: propertyProject.property_id } });
        if (!property) {
            throw new NotFoundException('Associated Property not found');
        }

        // 4️⃣ Ensure the inspector belongs to the same city as the property (admin bypasses city check)
        if (userRole === 'CITY_INSPECTOR') {
            const inspector = await manager.findOne(User, { where: { id: userId } });
            if (inspector && (inspector as any).city_id && (property as any).city_id && (inspector as any).city_id !== (property as any).city_id) {
                throw new BadRequestException('Inspector does not belong to the same city as the property');
            }
        }

        // 5️⃣ Check if permit exists for this project
        let permit = await manager.findOne(ProjectPermit, { where: { project_id: projectId } });
        
        if (permit) {
            // Update existing permit
            permit.status = dto.status as ProjectPermitStatus;
            permit.verified_by = userId;
            permit.verified_at = new Date();
            permit = await manager.save(permit);
        } else {
            // Create a new permit record for projects without uploaded permits
            permit = manager.create(ProjectPermit, {
                project_id: projectId,
                property_id: propertyProject.property_id,
                uploaded_by: userId,
                uploader_role: 'INSPECTOR',
                status: dto.status as ProjectPermitStatus,
                verified_by: userId,
                verified_at: new Date(),
                file_path: '', // Use empty string because file_path is required by the DB schema
                description: 'Verified without permit upload',
                notes: 'Project verified by inspector without permit document'
            } as any);
            permit = await manager.save(permit);
        }

        // 6️⃣ Sync the verified status to the component details
        let componentDetails: any;
        let repositoryToUse: any;

        if (propertyProject.project_type === 'ROOFING') {
            repositoryToUse = manager.getRepository('roofing');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'SIDING') {
            repositoryToUse = manager.getRepository('siding');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'WINDOWS') {
            repositoryToUse = manager.getRepository('windows');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'DOORS') {
            repositoryToUse = manager.getRepository('doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else if (propertyProject.project_type === 'GARAGE_DOORS') {
            repositoryToUse = manager.getRepository('garage_doors');
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id, isLatest: true } });
        } else {
            repositoryToUse = this.ownerProjectRepository;
            componentDetails = await repositoryToUse.findOne({ where: { project_id: propertyProject.id } });
        }

        if (componentDetails) {
            componentDetails.permit_status = permit.status;
            await repositoryToUse.save(componentDetails);
        }

        return {
            permit,
            project: propertyProject,
            message: permit.file_path 
                ? 'Project permit verification updated' 
                : 'Project verified without permit document'
        };
    }

    async uploadImage(ownerProjectId: string, file: Express.Multer.File, userId: string, userRole: string): Promise<ReportImage> {
        if (!file) {
            throw new BadRequestException('No file uploaded. Ensure you use the "file" field in your multipart/form-data request.');
        }

        // 1. Fetch the owner project details
        const details = await this.ownerProjectRepository.findOne({ where: { id: ownerProjectId } });
        if (!details) {
            throw new NotFoundException(`Homeowner project specification details with ID "${ownerProjectId}" not found`);
        }

        // 2. Check authorization: only the creator of the property project (or admin) can upload
        const project = await this.propertyProjectRepository.findOne({ where: { id: details.project_id } });
        if (!project) {
            throw new NotFoundException(`Associated property project with ID "${details.project_id}" not found`);
        }

        if (project.created_by !== userId && userRole !== 'admin') {
            throw new ForbiddenException(`You do not have permission to upload images for this project`);
        }

        // 3. Perform file upload (S3 with Local disk fallback)
        let imageUrl: string;
        let thumbnailUrl: string | null = null;
        
        const hasS3Config = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET;

        if (hasS3Config) {
            try {
                // Upload to S3
                const key = this.awsS3Service.generateKey('owner-projects', ownerProjectId, file.originalname);
                imageUrl = await this.awsS3Service.uploadFile(file, key);

                // Generate and upload a thumbnail to S3
                try {
                    const thumbBuffer = await sharp(file.buffer)
                        .resize({ width: 300, withoutEnlargement: true })
                        .blur(3)
                        .jpeg({ quality: 50 })
                        .toBuffer();
                    const thumbKey = this.awsS3Service.generateKey('owner-projects', ownerProjectId, file.originalname, 'thumb');
                    const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
                    thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);
                } catch (thumbErr) {
                    console.error('Failed to generate S3 thumbnail:', thumbErr);
                }
            } catch (s3Err) {
                console.error('S3 upload failed, falling back to local disk:', s3Err);
                imageUrl = await this.saveFileLocally(details.property_id, file);
            }
        } else {
            // Fall back to local disk
            imageUrl = await this.saveFileLocally(details.property_id, file);
        }

        // 4. Save to report_images table
        const record = this.reportImageRepository.create({
            owner_project_id: ownerProjectId,
            component_id: null,
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl || imageUrl,
            component_type: project.project_type,
            owner_uploaded: true,
            image_category: null,
        } as any);

        return await this.reportImageRepository.save(record as any) as ReportImage;
    }

    private async saveFileLocally(propertyId: string, file: Express.Multer.File): Promise<string> {
        const year = new Date().getFullYear().toString();
        const uploadDir = path.join(process.cwd(), 'uploads', propertyId, 'owner-projects', year);
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}_${Math.round(Math.random() * 1E9)}${fileExt}`;
        const filePath = path.join(uploadDir, fileName);

        fs.writeFileSync(filePath, file.buffer);

        return `/uploads/${propertyId}/owner-projects/${year}/${fileName}`;
    }
}
