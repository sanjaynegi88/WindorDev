import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { City } from '../entities/city.entity';
import { User } from '../entities/user.entity';
import { Property } from '../entities/property.entity';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
    constructor(
        @InjectRepository(City)
        private cityRepository: Repository<City>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Property)
        private propertyRepository: Repository<Property>
    ) {}

    async create(createCityDto: CreateCityDto): Promise<City> {
        // Check if city with same name already exists (Global Uniqueness, case-insensitive)
        const existingCity = await this.cityRepository
            .createQueryBuilder('city')
            .where('LOWER(city.name) = LOWER(:name)', { name: createCityDto.name })
            .getOne();

        if (existingCity) {
            throw new BadRequestException(`City with name "${createCityDto.name}" already exists`);
        }

        // Deduplicate zip codes
        if (createCityDto.zip_codes) {
            const uniqueZips = [...new Set(createCityDto.zip_codes)];
            
            // Check if any of these ZIP codes exist in another city
            for (const zip of uniqueZips) {
                const cityWithZip = await this.cityRepository.createQueryBuilder('city')
                    .where('city.zip_codes @> :zip', { zip: JSON.stringify([zip]) })
                    .getOne();
                
                if (cityWithZip) {
                    throw new BadRequestException(`ZIP code "${zip}" already exists for city "${cityWithZip.name}"`);
                }
            }
            createCityDto.zip_codes = uniqueZips;
        }

        const city = this.cityRepository.create(createCityDto);
        const savedCity = await this.cityRepository.save(city);
        return await this.findOne(savedCity.id);
    }

    async findAll(filters: any = {}): Promise<{ data: City[], total: number }> {
        const { name, state_id, is_active, page = 1, limit } = filters;
        const skip = limit ? (page - 1) * limit : undefined;
        
        const query = this.cityRepository.createQueryBuilder('city')
            .leftJoinAndSelect('city.state_entity', 'state');

        if (name) {
            query.andWhere('city.name ILIKE :name', { name: `${name}%` });
        }

        if (state_id) {
            query.andWhere('city.state_id = :state_id', { state_id });
        }

        if (is_active !== undefined) {
            query.andWhere('city.is_active = :is_active', { is_active });
        }

        if (limit !== undefined) {
            query.take(limit);
        }
        if (skip !== undefined) {
            query.skip(skip);
        }

        const [cities, total] = await query
            .orderBy('city.name', 'ASC')
            .getManyAndCount();

        return { data: cities, total };
    }

    async findOne(id: string): Promise<City> {
        const city = await this.cityRepository.findOne({
            where: { id },
            relations: ['state_entity']
        });

        if (!city) {
            throw new NotFoundException(`City with ID ${id} not found`);
        }

        return city;
    }

    async findOneByStateId(cityId: string, stateId: string): Promise<City> {
        const city = await this.cityRepository.findOne({
            where: { 
                id: cityId,
                state_id: stateId
            },
            relations: ['state_entity']
        });

        if (!city) {
            throw new NotFoundException(`City with ID ${cityId} not found in the specified state`);
        }

        return city;
    }

    async update(id: string, updateCityDto: UpdateCityDto): Promise<City> {
        const city = await this.findOne(id);

        // Check if updating to existing name (Global Uniqueness, case-insensitive)
        if (updateCityDto.name && updateCityDto.name.toLowerCase() !== city.name.toLowerCase()) {
            const existingCity = await this.cityRepository
                .createQueryBuilder('city')
                .where('LOWER(city.name) = LOWER(:name)', { name: updateCityDto.name })
                .andWhere('city.id != :id', { id })
                .getOne();

            if (existingCity) {
                throw new BadRequestException(`City with name "${updateCityDto.name}" already exists`);
            }
        }

        // Deduplicate zip codes
        if (updateCityDto.zip_codes) {
            const uniqueZips = [...new Set(updateCityDto.zip_codes)];

            // Check if any of these ZIP codes exist in another city
            for (const zip of uniqueZips) {
                const cityWithZip = await this.cityRepository.createQueryBuilder('city')
                    .where('city.zip_codes @> :zip', { zip: JSON.stringify([zip]) })
                    .andWhere('city.id != :id', { id })
                    .getOne();
                
                if (cityWithZip) {
                    throw new BadRequestException(`ZIP code "${zip}" already exists for city "${cityWithZip.name}"`);
                }
            }
            updateCityDto.zip_codes = uniqueZips;
        }

        await this.cityRepository.update(id, updateCityDto);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        const city = await this.findOne(id);
        
        // Check if any users are associated with this city
        const usersCount = await this.userRepository.count({
            where: { city_id: id as any }
        });
        
        // Check if any properties are associated with this city
        const propertiesCount = await this.propertyRepository.count({
            where: { city_id: id as any }
        });
        
        // If there are dependencies, prevent deletion
        if (usersCount > 0 || propertiesCount > 0) {
            const dependencies: string[] = [];
            if (usersCount > 0) {
                dependencies.push(`${usersCount} user(s)`);
            }
            if (propertiesCount > 0) {
                dependencies.push(`${propertiesCount} property(ies)`);
            }
            
            throw new BadRequestException(
                `Cannot delete city "${city.name}" because it is associated with ${dependencies.join(' and ')}. Please reassign or remove these records first.`
            );
        }
        
        await this.cityRepository.remove(city);
    }
}