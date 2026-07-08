import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ComponentImageCategoriesService } from './component-image-categories.service';
import { CreateComponentImageCategoryDto } from './dto/create-component-image-category.dto';
import { UpdateComponentImageCategoryDto } from './dto/update-component-image-category.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

// Public — no auth required, used by frontend to know what fields to show
@Controller('api/component-image-categories')
export class ComponentImageCategoriesPublicController {
    constructor(private readonly service: ComponentImageCategoriesService) {}

    @Get()
    async findAll(@Query('component_type') componentType?: string) {
        const data = await this.service.findAll(componentType);
        return { data };
    }
}

// Authenticated endpoint - supports all user roles
@Controller('api/auth/component-image-categories')
@UseGuards(AuthGuard('firebase-jwt'))
export class ComponentImageCategoriesAuthController {
    constructor(private readonly service: ComponentImageCategoriesService) {}

    @Get()
    async findAllAuthenticated(@Query('component_type') componentType?: string) {
        const data = await this.service.findAll(componentType);
        return { 
            data,
            message: 'Component image categories retrieved successfully'
        };
    }
}

// Admin-only CRUD
@Controller('api/admin/component-image-categories')
@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTRACTOR, UserRole.PROPERTY_OWNER, UserRole.MANUFACTURER)
export class ComponentImageCategoriesController {
    constructor(private readonly service: ComponentImageCategoriesService) {}

    @Post()
    @Roles(UserRole.ADMIN)
    async create(@Body() dto: CreateComponentImageCategoryDto) {
        const data = await this.service.create(dto);
        return { data, message: 'Component image category created successfully' };
    }

    @Get()
    async findAll(@Query('component_type') componentType?: string) {
        const data = await this.service.findAll(componentType);
        return { data };
    }

    @Put(':id')
    @Roles(UserRole.ADMIN)
    async update(@Param('id') id: string, @Body() dto: UpdateComponentImageCategoryDto) {
        validateUUID(id, 'category id');
        const data = await this.service.update(id, dto);
        return { data, message: 'Component image category updated successfully' };
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        validateUUID(id, 'category id');
        await this.service.remove(id);
        return { message: 'Component image category deleted successfully' };
    }
}
