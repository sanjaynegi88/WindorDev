import { Controller, Delete, UseGuards, Param, Req, Post, Body, UseInterceptors, UploadedFile, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PropertyProjectsService } from './property-projects.service';
import { OwnerProjectsService } from './owner-projects.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectPermitDto } from './dto/create-project-permit.dto';

@Controller('api/project')
@UseGuards(AuthGuard('firebase-jwt'))
export class ProjectController {
    constructor(
        private readonly propertyProjectsService: PropertyProjectsService,
        private readonly ownerProjectsService: OwnerProjectsService,
    ) {}

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'property project id');
        await this.propertyProjectsService.remove(id, req.user.id, req.user.role);
        return { message: 'Property project deleted successfully' };
    }

    @Post(':id/permit')
    @UseGuards(RolesGuard)
    @Roles(UserRole.PROPERTY_OWNER, UserRole.ADMIN, UserRole.CITY_INSPECTOR)
    @UseInterceptors(FileInterceptor('file'))
    async addPermitAlias(
        @Param('id') id: string,
        @Body() dto: CreateProjectPermitDto,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any
    ) {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            throw new UnauthorizedException('User not authenticated');
        }
        const data = await this.ownerProjectsService.addPermit(id, dto, file, userId, userRole);
        return { data, message: 'Project permit added successfully' };
    }
}
