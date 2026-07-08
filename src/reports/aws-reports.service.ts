import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ReportImage } from '../entities/report-image.entity';
import { Roofing } from '../entities/roofing.entity';
import { Siding } from '../entities/siding.entity';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { UserRole } from '../entities/user.entity';
import { AwsS3Service } from '../common/services/aws-s3.service';
import { ReportsService } from './reports.service';
import { ComponentImageCategoriesService } from '../component-image-categories/component-image-categories.service';
import sharp from 'sharp';

@Injectable()
export class AwsReportsService {
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
    ) { }

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
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
        return sharp(fileBuffer)
            .resize({ width: 200, withoutEnlargement: true })
            .blur(8)
            .jpeg({ quality: 25 })
            .toBuffer();
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
        await this.reportsService.checkImmutability(propertyId, componentType);

        // Validate image categories against DB
        await this.validateCategories(files, componentType);

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

            const reportImage = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                component_type: componentType,
                image_category: file.fieldname !== 'files' ? file.fieldname : null,
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
        } else {
            const comp = await this.doorsRepository.findOne({ where: { id: componentId } });
            if (!comp) throw new NotFoundException('Doors component not found');
            propertyId = comp.property_id;
        }

        const savedImages: any[] = [];

        for (const file of files) {
            // Upload original to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname);
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            // Generate thumbnail and upload to S3
            const thumbBuffer = await this.generateThumbnail(file.buffer);
            const thumbKey = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'thumb');
            const thumbFile = { ...file, buffer: thumbBuffer, mimetype: 'image/jpeg' };
            const thumbnailUrl = await this.awsS3Service.uploadFile(thumbFile, thumbKey);

            const reportImage = this.reportImageRepository.create({
                component_id: componentId,
                image_url: imageUrl,
                thumbnail_url: thumbnailUrl,
                component_type: componentType,
                image_category: file.fieldname !== 'files' ? file.fieldname : null,
            } as any);

            const saved = await this.reportImageRepository.save(reportImage as any);
            savedImages.push(saved);
        }

        return savedImages;
    }

    async uploadPropertyOwnerComponentImage(componentId: string, componentType: string, file: Express.Multer.File, ownerId: string): Promise<ReportImage> {
        if (!file) {
            throw new BadRequestException('No file uploaded.');
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

        // Upload to S3
        const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'owner');
        const imageUrl = await this.awsS3Service.uploadFile(file, key);

        // Check if there's an existing contractor image to pair with
        const existingImage = await this.reportImageRepository.findOne({
            where: { component_id: componentId, property_owner_files: IsNull() },
            order: { created_at: 'ASC' }
        });

        let saved: ReportImage;
        if (existingImage) {
            // Update existing record
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
                image_category: file.fieldname !== 'file' ? file.fieldname : null,
            };
            const reportImage = this.reportImageRepository.create(reportImageData as any);
            saved = await this.reportImageRepository.save(reportImage as any) as ReportImage;
        }

        return saved;
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

        const savedImages: ReportImage[] = [];
        // Get existing contractor images for this component (ones without property owner files yet)
        const existingImages = await this.reportImageRepository.find({
            where: { component_id: componentId, property_owner_files: IsNull() },
            order: { created_at: 'ASC' }
        });

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Upload to S3
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'owner');
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

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
                    image_category: (file as any).fieldname !== 'files' ? (file as any).fieldname : null,
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

        // 2. Check if property owner has uploaded images (owner_uploaded = true)
        const existingOwnerImages = await this.reportImageRepository.find({
            where: { component_id: componentId, owner_uploaded: true }
        });

        if (existingOwnerImages.length === 0) {
            throw new BadRequestException('No property owner images found for this component. Property owner must upload images first before admin can edit them.');
        }

        // 3. Delete old property owner image files from S3 and prepare records
        for (const image of existingOwnerImages) {
            if (image.property_owner_files) {
                await this.awsS3Service.deleteFile(image.property_owner_files);
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

        const savedImages: ReportImage[] = [];

        // 5. Upload new property owner images to S3
        for (const file of files) {
            const key = this.awsS3Service.generateKey(componentType, componentId, file.originalname, 'admin_edit');
            const imageUrl = await this.awsS3Service.uploadFile(file, key);

            const reportImageData: any = {
                component_id: componentId,
                property_owner_files: imageUrl,
                component_type: componentType,
                owner_uploaded: true
            };
            
            const reportImage = this.reportImageRepository.create(reportImageData);
            const saved = await this.reportImageRepository.save(reportImage);
            savedImages.push(saved as unknown as ReportImage);
        }

        return savedImages;
    }

    async prepareComponentForAdminContractorImageUpdate(componentId: string): Promise<void> {
        // 1. Fetch all images for this component
        const images = await this.reportImageRepository.find({
            where: { component_id: componentId }
        });

        // 2. Process each image
        for (const image of images) {
            if (image.owner_uploaded) {
                // If this record has an owner upload, keep the record but clear the contractor image + thumbnail
                if (image.image_url) {
                    await this.awsS3Service.deleteFile(image.image_url);
                    image.image_url = null;
                }
                if ((image as any).thumbnail_url) {
                    await this.awsS3Service.deleteFile((image as any).thumbnail_url);
                    (image as any).thumbnail_url = null;
                }
                await this.reportImageRepository.save(image as any);
            } else {
                // If it's only a contractor image, delete it entirely (file and record)
                if (image.image_url) {
                    await this.awsS3Service.deleteFile(image.image_url);
                }
                if ((image as any).thumbnail_url) {
                    await this.awsS3Service.deleteFile((image as any).thumbnail_url);
                }
                await this.reportImageRepository.delete(image.id);
            }
        }
    }

    async deleteComponentImages(componentId: string): Promise<void> {
        // Find all images for this component
        const images = await this.reportImageRepository.find({
            where: { component_id: componentId }
        });

        // Delete image files from S3
        for (const image of images) {
            if (image.image_url) {
                await this.awsS3Service.deleteFile(image.image_url);
            }
            if (image.property_owner_files) {
                await this.awsS3Service.deleteFile(image.property_owner_files);
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

        // Delete image files from S3
        if (image.image_url) {
            await this.awsS3Service.deleteFile(image.image_url);
        }
        if (image.property_owner_files) {
            await this.awsS3Service.deleteFile(image.property_owner_files);
        }

        // Delete image record from database
        await this.reportImageRepository.delete(imageId);
    }
}