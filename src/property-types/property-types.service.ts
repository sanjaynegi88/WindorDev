import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyType } from '../entities/property-type.entity';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';

@Injectable()
export class PropertyTypesService {
    constructor(
        @InjectRepository(PropertyType)
        private propertyTypeRepository: Repository<PropertyType>,
    ) {}

    async create(dto: CreatePropertyTypeDto): Promise<PropertyType> {
        const existing = await this.propertyTypeRepository.findOne({
            where: { type_name: dto.type_name },
        });
        if (existing) {
            throw new BadRequestException(`Property type "${dto.type_name}" already exists`);
        }
        const propertyType = this.propertyTypeRepository.create({ type_name: dto.type_name });
        return this.propertyTypeRepository.save(propertyType);
    }

    async findAll(id?: string): Promise<PropertyType | PropertyType[]> {
        if (id) {
            const propertyType = await this.propertyTypeRepository.findOne({ where: { id } });
            if (!propertyType) {
                throw new NotFoundException(`Property type with ID "${id}" not found`);
            }
            return propertyType;
        }
        return this.propertyTypeRepository.find({ order: { created_at: 'DESC' } });
    }

    async update(id: string, dto: UpdatePropertyTypeDto): Promise<PropertyType> {
        const propertyType = await this.propertyTypeRepository.findOne({ where: { id } });
        if (!propertyType) {
            throw new NotFoundException(`Property type with ID "${id}" not found`);
        }

        const duplicate = await this.propertyTypeRepository.findOne({
            where: { type_name: dto.type_name },
        });
        if (duplicate && duplicate.id !== id) {
            throw new BadRequestException(`Property type "${dto.type_name}" already exists`);
        }

        propertyType.type_name = dto.type_name;
        return this.propertyTypeRepository.save(propertyType);
    }

    async remove(id: string): Promise<void> {
        const propertyType = await this.propertyTypeRepository.findOne({ where: { id } });
        if (!propertyType) {
            throw new NotFoundException(`Property type with ID "${id}" not found`);
        }
        await this.propertyTypeRepository.remove(propertyType);
    }
}
