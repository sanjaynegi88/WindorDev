import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Brand } from '../entities/brand.entity';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class BrandsService {
    constructor(
        @InjectRepository(Brand)
        private brandRepository: Repository<Brand>,
    ) {}

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    async create(createBrandDto: CreateBrandDto, userRole: string): Promise<Brand> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can create brands');
        }

        // Trim whitespace from brand name
        const name = createBrandDto.name.trim();

        // Validate category existence (must match an existing category in the brands table)
        const category = createBrandDto.category?.trim().toUpperCase();
        if (category) {
            const existingCategories = await this.brandRepository
                .createQueryBuilder('brand')
                .select('DISTINCT brand.category', 'category')
                .getRawMany();
            const validCategories = existingCategories.map((c: any) => (c.category ? c.category.toUpperCase() : ''));
            if (!validCategories.includes(category)) {
                throw new BadRequestException({
                    statusCode: 400,
                    message: 'Invalid brand category. Must be one of existing categories.',
                    error: 'INVALID_BRAND_CATEGORY',
                    providedCategory: createBrandDto.category,
                    allowedCategories: validCategories,
                });
            }
            // assign normalized category back to DTO
            createBrandDto.category = category;
        }

        // Check if brand name already exists
        const existingBrand = await this.brandRepository.findOne({
            where: { name: name }
        });

        if (existingBrand) {
            throw new BadRequestException({
                statusCode: 400,
                message: 'Brand Creation Failed',
                error: 'DUPLICATE_BRAND_NAME',
                details: {
                    reason: `Brand name '${name}' already exists`,
                    existingBrandId: existingBrand.id,
                    solution: 'Please choose a different brand name'
                }
            });
        }

        const brand = this.brandRepository.create({
            ...createBrandDto,
            name: name
        });
        return await this.brandRepository.save(brand);
    }

    async findAll(category?: string, page: number = 1, limit?: number): Promise<{ data: Brand[], total: number }> {
        const skip = limit ? (page - 1) * limit : undefined;
        const where: any = {};
        if (category) {
            where.category = category;
        }


        const query = this.brandRepository.createQueryBuilder('brand')
            .where(where)
            .orderBy('brand.name', 'ASC');

        if (limit !== undefined) {
            query.take(limit);
        }
        if (skip !== undefined) {
            query.skip(skip);
        }

        const [brands, total] = await query.getManyAndCount();
        return { data: brands, total };
    }

    async findAllForAdmin(): Promise<Brand[]> {
        return await this.brandRepository.find({
            order: { created_at: 'DESC' }
        });
    }

    async findOne(id: string): Promise<Brand> {
        const brand = await this.brandRepository.findOne({
            where: { id }
        });

        if (!brand) {
            throw new NotFoundException(`Brand with ID ${id} not found`);
        }

        return brand;
    }

    async update(id: string, updateBrandDto: UpdateBrandDto, userRole: string): Promise<Brand> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can update brands');
        }

        const brand = await this.findOne(id);

        // If name is being updated, check for duplicates
        if (updateBrandDto.name) {
            const name = updateBrandDto.name.trim();
            
            // Check if another brand with this name exists (excluding current brand)
            const existingBrand = await this.brandRepository.findOne({
                where: { name: name }
            });
            
            if (existingBrand && existingBrand.id !== id) {
                throw new BadRequestException({
                    statusCode: 400,
                    message: 'Brand Update Failed',
                    error: 'DUPLICATE_BRAND_NAME',
                    details: {
                        reason: `Brand name '${name}' already exists`,
                        existingBrandId: existingBrand.id,
                        solution: 'Please choose a different brand name'
                    }
                });
            }
            
            updateBrandDto.name = name;
        }

        // Validate category if provided in update
        if (updateBrandDto.category) {
            const category = updateBrandDto.category.trim().toUpperCase();
            const existingCategories = await this.brandRepository
                .createQueryBuilder('brand')
                .select('DISTINCT brand.category', 'category')
                .getRawMany();
            const validCategories = existingCategories.map((c: any) => (c.category ? c.category.toUpperCase() : ''));
            if (!validCategories.includes(category)) {
                throw new BadRequestException({
                    statusCode: 400,
                    message: 'Invalid brand category on update.',
                    error: 'INVALID_BRAND_CATEGORY',
                    providedCategory: updateBrandDto.category,
                    allowedCategories: validCategories,
                });
            }
            // Normalize category value
            updateBrandDto.category = category;
        }
        await this.brandRepository.update(id, updateBrandDto);
        return await this.findOne(id);
    }

    async remove(id: string, userRole: string): Promise<void> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can delete brands');
        }

        const brand = await this.findOne(id);
        await this.brandRepository.remove(brand);
    }
}