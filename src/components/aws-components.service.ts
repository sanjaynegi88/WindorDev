import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Windows } from '../entities/windows.entity';
import { Doors } from '../entities/doors.entity';
import { GarageDoors } from '../entities/garage-doors.entity';
import { UserRole } from '../entities/user.entity';
import { AwsReportsService } from '../reports/aws-reports.service';

@Injectable()
export class AwsComponentsService {
    constructor(
        @InjectRepository(Windows)
        private windowsRepository: Repository<Windows>,
        @InjectRepository(Doors)
        private doorsRepository: Repository<Doors>,
        @InjectRepository(GarageDoors)
        private garageDoorsRepository: Repository<GarageDoors>,
        private readonly awsReportsService: AwsReportsService,
    ) { }

    private isAdmin(userRole: string): boolean {
        return userRole === UserRole.ADMIN;
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

    async adminUpdateComponentImages(componentId: string, componentType: string, files: any[], adminUserId: string, adminRole: string): Promise<any[]> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can modify component images');
        }

        // Prepare component for admin update (preserves property owner images)
        await this.awsReportsService.prepareComponentForAdminContractorImageUpdate(componentId);

        // Upload new contractor images to S3
        const newImages = await this.awsReportsService.adminUploadComponentImages(componentId, componentType, files);

        return newImages;
    }

    async adminDeleteImage(imageId: string, adminUserId: string, adminRole: string): Promise<void> {
        if (!this.isAdmin(adminRole)) {
            throw new BadRequestException('Only administrators can delete images');
        }

        await this.awsReportsService.deleteImage(imageId);
    }
}
