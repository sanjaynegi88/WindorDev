import { Controller, Post, Put, Delete, Body, Param, UseGuards, Req, Get, Query, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PropertyProjectsService } from './property-projects.service';
import { CreatePropertyProjectDto } from './dto/create-property-project.dto';
import { UpdatePropertyProjectDto } from './dto/update-property-project.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/property-projects')
@UseGuards(AuthGuard('firebase-jwt'))
export class PropertyProjectsController {
    constructor(private readonly propertyProjectsService: PropertyProjectsService) {}

    @Post(':propertyId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER)
    async create(@Param('propertyId') propertyId: string, @Body() dto: CreatePropertyProjectDto, @Req() req: any) {
        validateUUID(propertyId, 'property id');
        const data = await this.propertyProjectsService.create(propertyId, dto, req.user.id, req.user.role);
        return { data, message: 'Property project created successfully' };
    }

    @Get('property/:propertyId/types')
    async getPropertyProjectTypes(
        @Param('propertyId') propertyId: string,
        @Query('added_by') addedBy?: string
    ) {
        validateUUID(propertyId, 'property id');
        const data = await this.propertyProjectsService.getProjectTypesByPropertyId(propertyId, addedBy);
        return { data, message: 'Project types fetched successfully' };
    }

    @Get('property/:propertyId/full')
    async getProjectDetailsWithImages(
        @Param('propertyId') propertyId: string,
        @Query('added_by') addedBy?: string,
        @Query('project_type') projectType?: string
    ) {
        validateUUID(propertyId, 'property id');
        const data = await this.propertyProjectsService.getProjectDetailsWithImages(propertyId, addedBy, projectType);
        return { data, message: 'Project details and images fetched successfully' };
    }

    @Get('user/properties/full')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async getUserPropertiesWithFullProjects(@Req() req: any) {
        const data = await this.propertyProjectsService.getUserPropertiesWithFullProjects(req.user.id, req.user.role);
        return { data, message: 'User properties and full projects fetched successfully' };
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async update(@Param('id') id: string, @Body() dto: UpdatePropertyProjectDto, @Req() req: any) {
        validateUUID(id, 'property project id');
        const data = await this.propertyProjectsService.update(id, dto, req.user.id, req.user.role);
        return { data, message: 'Property project updated successfully' };
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'property project id');
        await this.propertyProjectsService.remove(id, req.user.id, req.user.role);
        return { message: 'Property project deleted successfully' };
    }
}