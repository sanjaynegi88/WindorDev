import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppSettingsService } from './app-settings.service';
import { CreateAppSettingDto } from './dto/create-app-setting.dto';
import { UpdateAppSettingDto } from './dto/update-app-setting.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/app-settings')
@UseGuards(AuthGuard('firebase-jwt'))
export class AppSettingsController {
    constructor(private readonly appSettingsService: AppSettingsService) {}

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() dto: CreateAppSettingDto) {
        const data = await this.appSettingsService.create(dto);
        return { data, message: 'Setting created successfully' };
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async findAll(@Query('id') id?: string) {
        if (id) {
            validateUUID(id, 'setting id');
        }
        const data = await this.appSettingsService.findAll(id);
        const list = Array.isArray(data) ? data : [data];
        if (list.length === 0) {
            return { data: [], message: 'No settings found.' };
        }
        return { data };
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(@Param('id') id: string, @Body() dto: UpdateAppSettingDto) {
        validateUUID(id, 'setting id');
        const data = await this.appSettingsService.update(id, dto);
        return { data, message: 'Setting updated successfully' };
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        validateUUID(id, 'setting id');
        await this.appSettingsService.remove(id);
        return { message: 'Setting deleted successfully' };
    }
}
