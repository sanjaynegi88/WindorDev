import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceProvided } from '../entities/service-provided.entity';
import { CreateServiceProvidedDto } from './dto/create-service-provided.dto';
import { UpdateServiceProvidedDto } from './dto/update-service-provided.dto';

@Injectable()
export class ServicesProvidedService {
    constructor(
        @InjectRepository(ServiceProvided)
        private serviceProvidedRepository: Repository<ServiceProvided>,
    ) {}

    async create(dto: CreateServiceProvidedDto): Promise<ServiceProvided> {
        const existing = await this.serviceProvidedRepository.findOne({
            where: { service_name: dto.service_name },
        });
        if (existing) {
            throw new BadRequestException(`Service "${dto.service_name}" already exists`);
        }
        const service = this.serviceProvidedRepository.create({ service_name: dto.service_name });
        return this.serviceProvidedRepository.save(service);
    }

    async findAll(id?: string): Promise<ServiceProvided | ServiceProvided[]> {
        if (id) {
            const service = await this.serviceProvidedRepository.findOne({ where: { id } });
            if (!service) {
                throw new NotFoundException(`Service with ID "${id}" not found`);
            }
            return service;
        }
        return this.serviceProvidedRepository.find({ order: { created_at: 'DESC' } });
    }

    async update(id: string, dto: UpdateServiceProvidedDto): Promise<ServiceProvided> {
        const service = await this.serviceProvidedRepository.findOne({ where: { id } });
        if (!service) {
            throw new NotFoundException(`Service with ID "${id}" not found`);
        }

        const duplicate = await this.serviceProvidedRepository.findOne({
            where: { service_name: dto.service_name },
        });
        if (duplicate && duplicate.id !== id) {
            throw new BadRequestException(`Service "${dto.service_name}" already exists`);
        }

        service.service_name = dto.service_name;
        return this.serviceProvidedRepository.save(service);
    }

    async remove(id: string): Promise<void> {
        const service = await this.serviceProvidedRepository.findOne({ where: { id } });
        if (!service) {
            throw new NotFoundException(`Service with ID "${id}" not found`);
        }
        await this.serviceProvidedRepository.remove(service);
    }
}
