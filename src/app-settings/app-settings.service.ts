import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { CreateAppSettingDto } from './dto/create-app-setting.dto';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';

@Injectable()
export class AppSettingsService {
    constructor(
        @InjectRepository(AppSetting)
        private appSettingRepository: Repository<AppSetting>,
    ) {}

    async create(dto: CreateAppSettingDto): Promise<AppSetting> {
        const existing = await this.appSettingRepository.findOne({ where: { key: dto.key } });
        if (existing) {
            throw new BadRequestException(`Setting with key "${dto.key}" already exists`);
        }
        const setting = this.appSettingRepository.create({
            key: dto.key,
            value: dto.value,
        });
        return this.appSettingRepository.save(setting);
    }

    async findAll(id?: string): Promise<AppSetting | AppSetting[]> {
        if (id) {
            const setting = await this.appSettingRepository.findOne({ where: { id } });
            if (!setting) {
                throw new NotFoundException(`Setting with ID "${id}" not found`);
            }
            return setting;
        }
        const settings = await this.appSettingRepository.find({ order: { createdAt: 'ASC' } });
        return settings;
    }

    async update(id: string, dto: UpdateAppSettingDto): Promise<AppSetting> {
        const setting = await this.appSettingRepository.findOne({ where: { id } });
        if (!setting) {
            throw new NotFoundException(`Setting with ID "${id}" not found`);
        }
        setting.value = dto.value;
        return this.appSettingRepository.save(setting);
    }

    async remove(id: string): Promise<void> {
        const setting = await this.appSettingRepository.findOne({ where: { id } });
        if (!setting) {
            throw new NotFoundException(`Setting with ID "${id}" not found`);
        }
        await this.appSettingRepository.remove(setting);
    }

    async getValue(key: string, fallback?: string): Promise<string> {
        const setting = await this.appSettingRepository.findOne({ where: { key } });
        if (!setting) {
            if (fallback !== undefined) return fallback;
            throw new NotFoundException(`App setting "${key}" not found`);
        }
        return setting.value;
    }
}
