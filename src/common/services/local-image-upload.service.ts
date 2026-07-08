import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportImage } from '../../entities/report-image.entity';
import { Roofing } from '../../entities/roofing.entity';
import { Siding } from '../../entities/siding.entity';
import { Windows } from '../../entities/windows.entity';
import { Doors } from '../../entities/doors.entity';
import { GarageDoors } from '../../entities/garage-doors.entity';
import { UserRole } from '../../entities/user.entity';
import { AwsS3Service } from './aws-s3.service';
import { ReportsService } from '../../reports/reports.service';
import { ComponentImageCategoriesService } from '../../component-image-categories/component-image-categories.service';
import { SUPPORTED_IMAGE_FORMATS } from '../utils/file-validation.util';
import sharp from 'sharp';

// ── Photo limits per component type ──────────────────────────────────────────
const PHOTO_LIMITS: Record<string, number> = {
    ROOFING: 4,
    SIDING: 5,
    WINDOWS: 4,
    DOORS: 4,
    GARAGE_DOORS: 4,
};

// ── Thumbnail settings ────────────────────────────────────────────────────────
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_QUALITY = 25;

@Injectable()
export class LocalImageUploadService {
    constructor(
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
        private readonly awsS3Service: AwsS3Service,
        private readonly reportsService: ReportsService,
        private readonly imageCategoriesService: ComponentImageCategoriesService,
    ) {}

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    private getPhotoLimit(componentType: string): number {
        return PHOTO_LIMITS[componentType.toUpperCase()] ?? 4;
    }

    private async validateCategories(files: Express.Multer.File[], componentType: string): Promise<void> {
        const allowed = await this.imageCategoriesService.getActiveCategories(componentType);
        for (const file of files) {
            if (!allowed.includes(file.fieldname)) {
                throw new BadRequestException(
                    `Invalid image category "${file.fieldname}" for ${componentType}. Allowed: ${allowed.join(', ')}`,
                );
            }
        }
    }

    /** Generate a compressed, blurred thumbnail buffer using sharp. */
    private async generateThumbnail(fileBuffer: Buffer): Promise<Buffer> {
        try {
            return await sharp(fileBuffer)
                .resize({ width: 300, withoutEnlargement: true }) 
                .blur(3)  
                .jpeg({ quality: 50 })
                .toBuffer();
        } catch (error: any) {
            if (error.message && error.message.includes('unsupported image format')) {
                throw new BadRequestException({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: `Unsupported image format. Please upload a valid image file (${SUPPORTED_IMAGE_FORMATS.join(', ')}).`,
                    supportedFormats: SUPPORTED_IMAGE_FORMATS,
                    solution: 'Upload one of the supported image formats.'
                });
            }
            throw new BadRequestException(`Image processing failed: ${error.message}`);
        }
    }

    // ── POST: contractor/admin upload (single file) ──────────────────────────

    async uploadComponentImage(
        componentId: string,
        componentType: string,
        file: Express.Multer.File,
        userId: string,
        userRole: string,
    ): Promise<ReportImage> {
        if (!file) {
            throw new BadRequestException('No file uploaded. Ensure you use the "file" field in your multipart/form-data request.');
        }

        // Resolve component → propertyId + ownership
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

        // Ownership check
        if (propertyCreatedBy !== userId && !isProjectContractor && !this.isAdmin(userRole)) {
            throw new ForbiddenException('You do not have permission to upload images for this component.');
        }

        // Validate image category against DB
        await this.validateCategories([file], componentType);

        // Upload original to S3
        const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname);
        const imageUrl = await this.awsS3Service.uploadFile(file, key);

        // Generate thumbnail and upload to S3
        const thumbBuffer = await this.generateThumbnail(file.buffer);
        const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb');
        const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
        const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

        const record = this.reportImageRepository.create({
            component_id: componentId,
            image_url: imageUrl,
            thumbnail_url: thumbnailUrl,
            component_type: componentType,
            image_category: file.fieldname !== 'file' ? file.fieldname : null,
        } as any);

        const saved = await this.reportImageRepository.save(record as any) as ReportImage;
        return saved;
    }

    // ── POST: contractor/admin upload (multiple files) ───────────────────────

    // ── POST: contractor/admin upload by category (one per field) ──────────────────────────────

    async uploadComponentImagesByCategory(
        componentId: string,
        componentType: string,
        files: Express.Multer.File[],
        userId: string,
        userRole: string,
    ): Promise<ReportImage[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded. Ensure you use category field names in your multipart/form-data request.');
        }

        // Resolve component → propertyId + ownership
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

        // Ownership check
        if (propertyCreatedBy !== userId && !isProjectContractor && !this.isAdmin(userRole)) {
            throw new ForbiddenException('You do not have permission to upload images for this component.');
        }

        // Validate all categories exist for this component type
        const allowedCategories = await this.imageCategoriesService.getActiveCategories(componentType);
        const uploadedCategories = new Set<string>();
        
        for (const file of files) {
            const category = file.fieldname;
            if (!allowedCategories.includes(category)) {
                throw new BadRequestException(
                    `Invalid image category "${category}" for ${componentType}. Allowed: ${allowedCategories.join(', ')}`,
                );
            }
            
            // Ensure only one image per category
            if (uploadedCategories.has(category)) {
                throw new BadRequestException(
                    `Multiple images provided for category "${category}". Only one image per category is allowed.`,
                );
            }
            uploadedCategories.add(category);
        }

        const savedImages: ReportImage[] = [];

        for (const file of files) {
            const category = file.fieldname;
            
            // Find existing image with this category
            const existingImage = await this.reportImageRepository.findOne({
                where: { 
                    component_id: componentId, 
                    image_category: category 
                }
            });

            // If existing image found, delete old files from S3
            if (existingImage) {
                if (existingImage.image_url) {
                    await this.awsS3Service.deleteFile(existingImage.image_url);
                }
                if ((existingImage as any).thumbnail_url) {
                    await this.awsS3Service.deleteFile((existingImage as any).thumbnail_url);
                }
            }

            // Upload original to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname);
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            // Generate thumbnail and upload to S3
            const thumbBuffer = await this.generateThumbnail(file.buffer);
            const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb');
            const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
            const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

            let saved: ReportImage;
            if (existingImage) {
                // Update existing record
                existingImage.image_url = imageUrl;
                (existingImage as any).thumbnail_url = thumbnailUrl;
                saved = await this.reportImageRepository.save(existingImage as any) as ReportImage;
            } else {
                // Create new record
                const record = this.reportImageRepository.create({
                    component_id: componentId,
                    image_url: imageUrl,
                    thumbnail_url: thumbnailUrl,
                    component_type: componentType,
                    image_category: category,
                } as any);
                saved = await this.reportImageRepository.save(record as any) as ReportImage;
            }
            
            savedImages.push(saved);
        }

        return savedImages;
    }

    async uploadComponentImages(
        componentId: string,
        componentType: string,
        files: Express.Multer.File[],
        userId: string,
        userRole: string,
    ): Promise<ReportImage[]> {
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded. Ensure you use the "files" field in your multipart/form-data request.');
        }

        // Resolve component → propertyId + ownership
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

        // Ownership check
        if (propertyCreatedBy !== userId && !isProjectContractor && !this.isAdmin(userRole)) {
            throw new ForbiddenException('You do not have permission to upload images for this component.');
        }

        // Validate image categories against DB
        await this.validateCategories(files, componentType);

        // Photo limit check — only count contractor images (image_url field)
        const limit = this.getPhotoLimit(componentType);
        const existing = await this.reportImageRepository
            .createQueryBuilder('img')
            .where('img.component_id = :componentId', { componentId })
            .andWhere('img.image_url IS NOT NULL')
            .getCount();
        if (existing + files.length > limit) {
            throw new BadRequestException(
                `Photo limit exceeded. ${componentType} allows a maximum of ${limit} photos. Currently has ${existing}.`,
            );
        }

        const savedImages: ReportImage[] = [];

        for (const file of files) {
            // Upload original to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname);
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            // Generate thumbnail and upload to S3
            const thumbBuffer = await this.generateThumbnail(file.buffer);
            const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb');
            const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
            const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

            const record = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                component_type: componentType,
                image_category: file.fieldname !== 'files' ? file.fieldname : null,
            } as any);

            const saved = await this.reportImageRepository.save(record as any) as ReportImage;
            savedImages.push(saved);
        }

        return savedImages;
    }

    // ── PUT: admin replace contractor images by category (one per field) ──────────────────

    async adminUpdateComponentImagesByCategory(
        componentId: string,
        componentType: string,
        files: Express.Multer.File[],
        _adminUserId: string,
        adminRole: string,
    ): Promise<ReportImage[]> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify component images.');
        }
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded.');
        }

        // Validate all categories exist for this component type
        const allowedCategories = await this.imageCategoriesService.getActiveCategories(componentType);
        const uploadedCategories = new Set<string>();
        
        for (const file of files) {
            const category = file.fieldname;
            if (!allowedCategories.includes(category)) {
                throw new BadRequestException(
                    `Invalid image category "${category}" for ${componentType}. Allowed: ${allowedCategories.join(', ')}`,
                );
            }
            
            // Ensure only one image per category
            if (uploadedCategories.has(category)) {
                throw new BadRequestException(
                    `Multiple images provided for category "${category}". Only one image per category is allowed.`,
                );
            }
            uploadedCategories.add(category);
        }

        const savedImages: ReportImage[] = [];

        for (const file of files) {
            const category = file.fieldname;
            
            // Find existing image with this category
            const existingImage = await this.reportImageRepository.findOne({
                where: { 
                    component_id: componentId, 
                    image_category: category 
                }
            });

            // If existing image found, delete old files from S3
            if (existingImage) {
                if (existingImage.image_url) {
                    await this.awsS3Service.deleteFile(existingImage.image_url);
                }
                if ((existingImage as any).thumbnail_url) {
                    await this.awsS3Service.deleteFile((existingImage as any).thumbnail_url);
                }
            }

            // Upload new image to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'admin_category');
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            // Generate thumbnail and upload to S3
            const thumbBuffer = await this.generateThumbnail(file.buffer);
            const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb_admin_category');
            const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
            const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

            let saved: ReportImage;
            if (existingImage) {
                // Update existing record
                existingImage.image_url = imageUrl;
                (existingImage as any).thumbnail_url = thumbnailUrl;
                saved = await this.reportImageRepository.save(existingImage as any) as ReportImage;
            } else {
                // Create new record
                const record = this.reportImageRepository.create({
                    component_id: componentId,
                    image_url: imageUrl,
                    thumbnail_url: thumbnailUrl,
                    component_type: componentType,
                    image_category: category,
                } as any);
                saved = await this.reportImageRepository.save(record as any) as ReportImage;
            }
            
            savedImages.push(saved);
        }

        return savedImages;
    }

    // ── PUT: admin replace contractor images ──────────────────────────────────

    async adminUpdateComponentImages(
        componentId: string,
        componentType: string,
        files: Express.Multer.File[],
        _adminUserId: string,
        adminRole: string,
    ): Promise<ReportImage[]> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify component images.');
        }
        if (!files || files.length === 0) {
            throw new BadRequestException('No files uploaded.');
        }

        // Photo limit check
        const limit = this.getPhotoLimit(componentType);
        if (files.length > limit) {
            throw new BadRequestException(
                `Photo limit exceeded. ${componentType} allows a maximum of ${limit} photos.`,
            );
        }

        // Delete existing contractor images from S3 (preserve owner images)
        await this.prepareForAdminUpdate(componentId);

        const savedImages: ReportImage[] = [];

        for (const file of files) {
            // Upload original to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'admin');
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            // Generate thumbnail and upload to S3
            const thumbBuffer = await this.generateThumbnail(file.buffer);
            const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb_admin');
            const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
            const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

            const record = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                component_type: componentType,
                image_category: file.fieldname !== 'files' ? file.fieldname : null,
            } as any);

            const saved = await this.reportImageRepository.save(record as any) as ReportImage;
            savedImages.push(saved);
        }

        return savedImages;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async prepareForAdminUpdate(componentId: string): Promise<void> {
        const images = await this.reportImageRepository.find({ where: { component_id: componentId } });

        for (const image of images) {
            if (image.owner_uploaded) {
                // Paired record: clear contractor image + thumbnail from S3, keep owner data
                if (image.image_url) {
                    await this.awsS3Service.deleteFile(image.image_url);
                    (image as any).image_url = null;
                }
                if ((image as any).thumbnail_url) {
                    await this.awsS3Service.deleteFile((image as any).thumbnail_url);
                    (image as any).thumbnail_url = null;
                }
                await this.reportImageRepository.save(image as any);
            } else {
                // Contractor-only record: delete from S3 + remove DB record
                if (image.image_url) await this.awsS3Service.deleteFile(image.image_url);
                if ((image as any).thumbnail_url) await this.awsS3Service.deleteFile((image as any).thumbnail_url);
                await this.reportImageRepository.delete(image.id);
            }
        }
    }
}
