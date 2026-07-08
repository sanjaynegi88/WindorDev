import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { BadRequestException } from '@nestjs/common';
// Public endpoint with optional auth
@Controller('api/roles')
export class RolesPublicController {
    constructor(private readonly rolesService: RolesService) {}

    @Get()
    async getRoles(@Headers('authorization') authorization?: string) {
        // If no token provided, return public roles only
        if (!authorization || !authorization.startsWith('Bearer ')) {
            const data = await this.rolesService.getPublicRoles();
            return { data };
        }

        // If token provided, try to get user info and return appropriate roles
        try {
            const data = await this.rolesService.getRolesByAuth(authorization);
            return { data };
        } catch (error) {
            // If token is invalid, return public roles
            const data = await this.rolesService.getPublicRoles();
            return { data };
        }
    }
}

// Admin-only endpoints
@Controller('api/roles')
@UseGuards(AuthGuard('firebase-jwt'))
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

  @Post()
  async create(@Body() dto: CreateRoleDto) {
    // Additional runtime check (defensive)
    if (dto.role_name !== dto.role_name.toUpperCase()) {
      throw new BadRequestException('role_name must be uppercase');
    }
    return this.rolesService.create(dto);
  }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async findAll(@Query('id') id?: string) {
        if (id) {
            validateUUID(id, 'role id');
        }
        const data = await this.rolesService.findAll(id);
        const list = Array.isArray(data) ? data : [data];
        if (list.length === 0) {
            return { data: [], message: 'No roles found.' };
        }
        return { data };
    }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    if (dto.role_name && dto.role_name !== dto.role_name.toUpperCase()) {
      throw new BadRequestException('role_name must be uppercase');
    }
    return this.rolesService.update(id, dto);
  }


    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string) {
        validateUUID(id, 'role id');
        await this.rolesService.remove(id);
        return { message: 'Role deleted successfully' };
    }
}
