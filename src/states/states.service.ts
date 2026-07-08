import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { State } from '../entities/state.entity';
import { CreateStateDto } from './dto/create-state.dto';
import { UpdateStateDto } from './dto/update-state.dto';

@Injectable()
export class StatesService {
    constructor(
        @InjectRepository(State)
        private stateRepository: Repository<State>
    ) {}

    async create(createStateDto: CreateStateDto): Promise<State> {
        const existing = await this.stateRepository
            .createQueryBuilder('state')
            .where('LOWER(state.state_name) = LOWER(:name)', { name: createStateDto.state_name })
            .getOne();

        if (existing) {
            throw new BadRequestException(`State with name "${createStateDto.state_name}" already exists`);
        }

        const state = this.stateRepository.create(createStateDto);
        return await this.stateRepository.save(state);
    }

    async findAll(filters: any = {}): Promise<{ data: State[], total: number }> {
        const { name, page = 1, limit } = filters;
        const skip = limit ? (page - 1) * limit : undefined;
        
        const query = this.stateRepository.createQueryBuilder('state');

        if (name) {
            query.andWhere('state.state_name ILIKE :name', { name: `%${name}%` });
        }

        if (limit !== undefined) {
            query.take(limit);
        }
        if (skip !== undefined) {
            query.skip(skip);
        }

        const [states, total] = await query.orderBy('state.state_name', 'ASC').getManyAndCount();
        return { data: states, total };
    }

    async findOne(id: string): Promise<State> {
        const state = await this.stateRepository.findOne({
            where: { id },
            relations: ['cities']
        });

        if (!state) {
            throw new NotFoundException(`State with ID ${id} not found`);
        }

        return state;
    }

    async update(id: string, updateStateDto: UpdateStateDto): Promise<State> {
        const state = await this.findOne(id);

        if (updateStateDto.state_name && updateStateDto.state_name.toLowerCase() !== state.state_name.toLowerCase()) {
            const existing = await this.stateRepository
                .createQueryBuilder('state')
                .where('LOWER(state.state_name) = LOWER(:name)', { name: updateStateDto.state_name })
                .getOne();

            if (existing) {
                throw new BadRequestException(`State with name "${updateStateDto.state_name}" already exists`);
            }
        }

        await this.stateRepository.update(id, updateStateDto);
        return await this.findOne(id);
    }

    async remove(id: string): Promise<void> {
        const state = await this.findOne(id);
        
        if (state.cities && state.cities.length > 0) {
            throw new BadRequestException(
                `Cannot delete state "${state.state_name}" because it has ${state.cities.length} associated cities. Please reassign or remove these cities first.`
            );
        }

        await this.stateRepository.remove(state);
    }
}
