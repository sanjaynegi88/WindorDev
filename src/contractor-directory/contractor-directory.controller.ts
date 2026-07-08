import { 
    Controller, 
    Post, 
    Get, 
    Put, 
    Delete, 
    Body, 
    UseGuards, 
    Req, 
    UseInterceptors, 
    UploadedFile,
    Query,
    Param,
    ValidationPipe,
    BadRequestException
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractorDirectoryService } from './contractor-directory.service';
import { CreateContractorDirectoryProfileDto, UpdateContractorDirectoryProfileDto } from './dto/contractor-directory-profile.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';

@Controller('api/contractor-directory-profile')
@UseGuards(AuthGuard('firebase-jwt'))
export class ContractorDirectoryController {
    constructor(
        private readonly contractorDirectoryService: ContractorDirectoryService
    ) {}

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(FileInterceptor('company_logo'))
    async createProfile(
        @Body(ValidationPipe) createDto: CreateContractorDirectoryProfileDto,
        @Req() req: any,
        @UploadedFile() file?: any
    ) {
        const profile = await this.contractorDirectoryService.createProfile(req.user.id, createDto, file);
        return {
            data: profile,
            message: 'Contractor directory profile created successfully'
        };
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async getOwnProfile(@Req() req: any) {
        const profile = await this.contractorDirectoryService.getOwnProfile(req.user.id);
        return {
            data: profile,
            message: 'Profile retrieved successfully'
        };
    }

    @Put()
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    @UseInterceptors(FileInterceptor('company_logo'))
    async updateProfile(
        @Body(ValidationPipe) updateDto: UpdateContractorDirectoryProfileDto,
        @Req() req: any,
        @UploadedFile() file?: any
    ) {
        const profile = await this.contractorDirectoryService.updateProfile(req.user.id, updateDto, file);
        return {
            data: profile,
            message: 'Contractor directory profile updated successfully'
        };
    }

    @Delete()
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONTRACTOR, UserRole.MANUFACTURER)
    async deleteProfile(@Req() req: any) {
        await this.contractorDirectoryService.deleteProfile(req.user.id);
        return {
            message: 'Contractor directory profile deleted successfully'
        };
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async adminDeleteProfile(@Param('id') id: string) {
        validateUUID(id, 'profile id');
        await this.contractorDirectoryService.adminDeleteProfile(id);
        return {
            message: 'Contractor directory profile deleted successfully'
        };
    }
}

@Controller('api/admin/contractor-directory-profile')
@UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class ContractorDirectoryAdminController {
    constructor(
        private readonly contractorDirectoryService: ContractorDirectoryService
    ) {}

    @Put(':id')
    @UseInterceptors(FileInterceptor('company_logo'))
    async adminUpdateProfile(
        @Param('id') id: string,
        @Body(ValidationPipe) updateDto: UpdateContractorDirectoryProfileDto,
        @UploadedFile() file?: any
    ) {
        validateUUID(id, 'profile id');
        const profile = await this.contractorDirectoryService.adminUpdateProfile(id, updateDto, file);
        return {
            data: profile,
            message: 'Contractor directory profile updated successfully'
        };
    }

    @Delete(':id')
    async adminDeleteProfile(@Param('id') id: string) {
        validateUUID(id, 'profile id');
        await this.contractorDirectoryService.adminDeleteProfile(id);
        return {
            message: 'Contractor directory profile deleted successfully'
        };
    }
}

@Controller('api/contractor-directory')
export class ContractorDirectoryPublicController {
    constructor(
        private readonly contractorDirectoryService: ContractorDirectoryService
    ) {}

    @Get()
    async getAllProfiles(
        @Query('id') id?: string,
        @Query('city_id') cityId?: string,
        @Query('radius') radius?: string,
        @Query('service') service?: string,
        @Query('keyword') keyword?: string,
        @Req() req?: any
    ) {
        if (req?.user?.id) {
            await this.contractorDirectoryService.assertDirectoryAccess(req.user.id);
        }

        if (id) {
            validateUUID(id, 'profile id');
        }

        if (cityId) {
            validateUUID(cityId, 'city id');
        }

        if (service) {
            validateUUID(service, 'service id');
        }

        const radiusNum = radius ? parseFloat(radius) : undefined;
        if (radiusNum && (isNaN(radiusNum) || radiusNum <= 0)) {
            throw new BadRequestException('Radius must be a positive number');
        }

        const profiles = await this.contractorDirectoryService.getAllProfiles(id, cityId, radiusNum, service, keyword);
        
        if (id && profiles.length > 0) {
            return {
                data: profiles[0],
                message: 'Profile found successfully'
            };
        }

        return {
            data: profiles,
            message: `Found ${profiles.length} contractor profiles`
        };
    }
} 