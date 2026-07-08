import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PropertyTypesService } from './property-types.service';
import { CreatePropertyTypeDto } from './dto/create-property-type.dto';
import { UpdatePropertyTypeDto } from './dto/update-property-type.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/property-types')
@UseGuards(AuthGuard('firebase-jwt'))
export class PropertyTypesController {
    constructor(private readonly propertyTypesService: PropertyTypesService) {}

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() dto: CreatePropertyTypeDto) {
        const data = await this.propertyTypesService.create(dto);
        return { data, message: 'Property type created successfully' };
    }

    @Get()
    // All authenticated roles can view
    async findAll(@Query('id') id?: string) {
        if (id) {
            validateUUID(id, 'property type id');
        }
        const data = await this.propertyTypesService.findAll(id);
        const list = Array.isArray(data) ? data : [data];
        if (list.length === 0) {
            return { data: [], message: 'No property types found.' };
        }
        return { data };
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(@Param('id') id: string, @Body() dto: UpdatePropertyTypeDto) {
        validateUUID(id, 'property type id');
        const data = await this.propertyTypesService.update(id, dto);
        return { data, message: 'Property type updated successfully' };
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        validateUUID(id, 'property type id');
        await this.propertyTypesService.remove(id);
        return { message: 'Property type deleted successfully' };
    }
}
