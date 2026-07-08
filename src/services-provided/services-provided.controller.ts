import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ServicesProvidedService } from './services-provided.service';
import { CreateServiceProvidedDto } from './dto/create-service-provided.dto';
import { UpdateServiceProvidedDto } from './dto/update-service-provided.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/services-provided')
export class ServicesProvidedController {
    constructor(private readonly servicesProvidedService: ServicesProvidedService) {}

    @Post()
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() dto: CreateServiceProvidedDto) {
        const data = await this.servicesProvidedService.create(dto);
        return { data, message: 'Service created successfully' };
    }

    @Get()
    // All authenticated roles can view
    async findAll(@Query('id') id?: string) {
        if (id) {
            validateUUID(id, 'service id');
        }
        const data = await this.servicesProvidedService.findAll(id);
        const list = Array.isArray(data) ? data : [data];
        if (list.length === 0) {
            return { data: [], message: 'No services found.' };
        }
        return { data };
    }

    @Put(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(@Param('id') id: string, @Body() dto: UpdateServiceProvidedDto) {
        validateUUID(id, 'service id');
        const data = await this.servicesProvidedService.update(id, dto);
        return { data, message: 'Service updated successfully' };
    }

    @Delete(':id')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        validateUUID(id, 'service id');
        await this.servicesProvidedService.remove(id);
        return { message: 'Service deleted successfully' };
    }
}
