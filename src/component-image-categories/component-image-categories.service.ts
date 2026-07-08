import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComponentImageCategory } from '../entities/component-image-category.entity';
import { CreateComponentImageCategoryDto } from './dto/create-component-image-category.dto';
import { UpdateComponentImageCategoryDto } from './dto/update-component-image-category.dto';

@Injectable()
export class ComponentImageCategoriesService {
    constructor(
        @InjectRepository(ComponentImageCategory)
        private categoryRepository: Repository<ComponentImageCategory>,
    ) {}

    private generateCategoryName(displayName: string): string {
        return displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }

    async create(dto: CreateComponentImageCategoryDto): Promise<ComponentImageCategory> {
        // Transform display name to category name
        const categoryName = this.generateCategoryName(dto.display_name);
        
        const existing = await this.categoryRepository.findOne({
            where: { component_type: dto.component_type, category_name: categoryName },
        });
        if (existing) {
            throw new BadRequestException(
                `Category "${categoryName}" already exists for ${dto.component_type}`,
            );
        }
        const category = this.categoryRepository.create({
            component_type: dto.component_type,
            display_name: dto.display_name.trim(),
            category_name: categoryName,
        });
        return this.categoryRepository.save(category);
    }

    async findAll(componentType?: string): Promise<ComponentImageCategory[]> {
        const where: any = {};
        if (componentType) {
            where.component_type = componentType;
        }
        return this.categoryRepository.find({
            where,
            order: { component_type: 'ASC', category_name: 'ASC' },
        });
    }

    async findOne(id: string): Promise<ComponentImageCategory> {
        const category = await this.categoryRepository.findOne({ where: { id } });
        if (!category) {
            throw new NotFoundException(`Category with ID "${id}" not found`);
        }
        return category;
    }

    async update(id: string, dto: UpdateComponentImageCategoryDto): Promise<ComponentImageCategory> {
        const category = await this.findOne(id);

        if (dto.display_name && dto.display_name.trim() !== category.display_name) {
            // Transform display name to category name
            const categoryName = this.generateCategoryName(dto.display_name);
            
            const duplicate = await this.categoryRepository.findOne({
                where: { component_type: category.component_type, category_name: categoryName },
            });
            if (duplicate) {
                throw new BadRequestException(
                    `Category "${categoryName}" already exists for ${category.component_type}`,
                );
            }
            category.display_name = dto.display_name.trim();
            category.category_name = categoryName;
        }

        return this.categoryRepository.save(category);
    }

    async remove(id: string): Promise<void> {
        const category = await this.findOne(id);
        await this.categoryRepository.remove(category);
    }

    // Used by upload services to validate incoming field names
    async getActiveCategories(componentType: string): Promise<string[]> {
        const categories = await this.categoryRepository.find({
            where: { component_type: componentType },
        });
        return categories.map(c => c.category_name);
    }
}
