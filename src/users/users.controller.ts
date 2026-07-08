import { Controller, Get, Put, Delete, Body, UseGuards, Req, UseInterceptors, UploadedFile, Query, Param, HttpStatus, ForbiddenException, BadRequestException, Post } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto, ProcessedUpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';
import { MembershipPlansService } from '../membership-plans/membership-plans.service';
import { PurchaseAdditionalUsersDto } from '../membership-plans/dto/purchase-additional-users.dto';
import { ReactivateUsersDto } from '../membership-plans/dto/reactivate-users.dto';
import { profileImageValidator } from '../common/utils/file-validation.util';
import { diskStorage } from 'multer';

@Controller('api/users')
@UseGuards(AuthGuard('firebase-jwt'))
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly auditService: AuditService,
        private readonly membershipPlansService: MembershipPlansService
    ) { }

    @Get('profile')
    async getProfile(@Req() req: any) {
        // The userId comes from the FirebaseJwtStrategy which attaches user from Postgres
        const userId = req.user.id;
        const profile = await this.usersService.getProfile(userId);
        return { data: profile };
    }

    @Put('profile')
    @UseInterceptors(FileInterceptor('image', {
        fileFilter: profileImageValidator
    }))
    async updateProfile(
        @Req() req: any,
        @Body() updateProfileDto: UpdateProfileDto,
        @UploadedFile() file?: Express.Multer.File
    ) {
        const processedDto: ProcessedUpdateProfileDto = {
            first_name: updateProfileDto.first_name,
            last_name: updateProfileDto.last_name,
            display_name: updateProfileDto.display_name,
            company_name: updateProfileDto.company_name,
            profile_image_url: updateProfileDto.profile_image_url,
            city_id: updateProfileDto.city_id,
            state_id: updateProfileDto.state_id,
            companyAddress: updateProfileDto.companyAddress,
            websiteUrl: updateProfileDto.websiteUrl,
            mobilePhone: updateProfileDto.mobilePhone,
            companyPhone: updateProfileDto.companyPhone,
            propertyAddress: updateProfileDto.propertyAddress,
            ownerDateStart: updateProfileDto.ownerDateStart,
            ownerDateEnd: updateProfileDto.ownerDateEnd,
            serviceTypes: updateProfileDto.serviceTypes,
            title: updateProfileDto.title,
            cityOfficial: updateProfileDto.cityOfficial,
            cityAddress: updateProfileDto.cityAddress,
            cityPhone: updateProfileDto.cityPhone,
        };
        
        const userId = req.user.id;
        const firebaseUid = req.user.firebase_uid;
        const userRole = req.user.role;

        if (userRole === UserRole.CITY_INSPECTOR && updateProfileDto.state_id !== undefined) {
            throw new ForbiddenException('City Inspectors are not allowed to update their state');
        }
        
        // Get current profile and user data for audit logging
        const oldProfile = await this.usersService.getProfile(userId);
        const oldUser = await this.usersService.findUserById(userId);
        
        const profile = await this.usersService.updateProfile(userId, firebaseUid, processedDto, file);
        const newUser = await this.usersService.findUserById(userId);
        
        // Log profile update audit (including user fields)
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'user_profiles',
                recordId: userId,
                action: 'UPDATE',
                oldValues: {
                    // User table fields
                    first_name: oldUser?.first_name || null,
                    last_name: oldUser?.last_name || null,
                    city_id: oldUser?.city_id || null,
                    state_id: oldUser?.state_id || null,
                    // Profile table fields
                    display_name: oldProfile.display_name,
                   
                    company_name: oldProfile.company_name,
                   
                    profile_image_url: oldProfile.profile_image_url
                },
                newValues: {
                    // User table fields
                    first_name: newUser?.first_name || null,
                    last_name: newUser?.last_name || null,
                    city_id: newUser?.city_id || null,
                    state_id: newUser?.state_id || null,
                    // Profile table fields
                    display_name: profile.display_name,
                   
                    company_name: profile.company_name,
                    
                    profile_image_url: profile.profile_image_url
                },
                changedByUserId: userId,
                changeReason: `${req.user.role} user updated profile information`,
                ipAddress,
                userAgent
            });
            
           
        } catch (error) {
            console.error('Failed to log profile update audit:', error);
        }
        
        return { 
            data: profile,
            message: 'Profile updated successfully'
        };
    }

    @Post('purchase')
    async purchaseAdditionalUsers(@Body() dto: PurchaseAdditionalUsersDto, @Req() req: any) {
        const result = await this.membershipPlansService.purchaseAdditionalUsers(req.user.id, dto);
        
        return {
            data: {
                purchaseId: result.purchaseId,
                checkout_session: { url: result.checkoutUrl }
            },
            message: 'Checkout session created for additional users purchase'
        };
    }

    @Post('reactivate-purchase')
    @UseGuards(RolesGuard)
    @Roles(UserRole.CONTRACTOR)
    async reactivateUsers(@Body() dto: ReactivateUsersDto, @Req() req: any) {
        const result = await this.membershipPlansService.reactivateUsers(req.user.id, dto);
        return {
            data: result,
            message: 'Reactivation checkout session created successfully'
        };
    }

    @Get('all')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getAllUsers(
        @Query('id') id?: string,
        @Query('first_name') first_name?: string,
        @Query('last_name') last_name?: string,
        @Query('role') role?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string
    ) {
        if (id) {
            validateUUID(id, 'user id');
        }

        const validRoles = Object.values(UserRole);
        if (role && !validRoles.includes(role as UserRole)) {
            throw new BadRequestException(
                `Invalid role "${role}". Valid roles are: ${validRoles.join(', ')}`
            );
        }
        
        const pageNum = page ? parseInt(page, 10) : 1;
        const limitNum = limit ? parseInt(limit, 10) : undefined;

        const filters = {
            id,
            first_name,
            last_name,
            role,
            page: pageNum,
            limit: limitNum
        };
        const { data: users, total } = await this.usersService.getAllUsers(filters);
        
        if (filters.id && users.length > 0) {
            return {
                data: users[0],
                message: 'User found successfully'
            };
        }

        return { 
            data: users,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: limitNum ? Math.ceil(total / limitNum) : 1
            },
            message: `Found ${users.length} users`
        };
    }

    private throwAccessDeniedError(currentUserRole: string, targetUserRole: string, action: string) {
        let message = '';
        let reason = '';
        
        if (currentUserRole === UserRole.CITY_INSPECTOR) {
            message = 'Access Denied - City Inspector can only manage their sub-account users';
            reason = 'City Inspectors can only update/delete sub-account users within their city organization';
        } else if (currentUserRole === UserRole.INSURANCE_COMPANY) {
            message = 'Access Denied - Insurance Company can only manage their sub-account users';
            reason = 'Insurance Company users can only update/delete sub-account users within their insurance company';
        } else {
            message = 'Access Denied - Insufficient permissions';
            reason = 'You do not have permission to perform this action on this user';
        }
        
        throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            message,
            error: 'INSUFFICIENT_PERMISSIONS',
            details: {
                currentRole: currentUserRole,
                targetUserRole,
                action,
                reason,
                solution: currentUserRole === UserRole.ADMIN ? 
                    'Contact system administrator' : 
                    'You can only manage sub-account users within your organization'
            }
        });
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('image', {
        fileFilter: profileImageValidator
    }))
    async updateUser(
        @Param('id') targetUserId: string,
        @Body() updateData: any,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any
    ) {
        validateUUID(targetUserId, 'user id');
        
        const currentUser = req.user;
        
        // Only ADMIN can use this endpoint
        if (currentUser.role !== UserRole.ADMIN) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'Access Denied - Administrator Privileges Required',
                error: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Get old user data for audit logging
        const oldUser = await this.usersService.findUserById(targetUserId);
        const oldProfile = await this.usersService.getProfile(targetUserId);
        
        // Prepare the update data
        const processedDto = {
            first_name: updateData.first_name,
            last_name: updateData.last_name,
            display_name: updateData.display_name,
            company_name: updateData.company_name,
            profile_image_url: updateData.profile_image_url,
            city_id: updateData.city_id,
        };
        
        const updatedUser = await this.usersService.updateUserWithProfile(targetUserId, processedDto, file);
        
        // Log user update audit
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'users',
                recordId: targetUserId,
                action: 'UPDATE',
                oldValues: {
                    first_name: oldUser?.first_name || null,
                    last_name: oldUser?.last_name || null,
                    display_name: oldProfile?.display_name || null,
                    company_name: oldProfile?.company_name || null
                },
                newValues: {
                    first_name: updatedUser.first_name,
                    last_name: updatedUser.last_name,
                    display_name: updatedUser.profile?.display_name || null,
                    company_name: updatedUser.profile?.company_name || null
                },
                changedByUserId: currentUser.id,
                changeReason: `ADMIN updated user information`,
                ipAddress,
                userAgent
            });
        } catch (auditError) {
            console.error('Failed to log user update audit:', auditError);
        }
        
        return {
            data: updatedUser,
            message: 'User updated successfully by administrator',
            updatedBy: currentUser.id,
            updatedAt: new Date().toISOString()
        };
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async deleteUser(
        @Param('id') targetUserId: string,
        @Req() req: any
    ) {
        validateUUID(targetUserId, 'user id');
        
        const currentUser = req.user;
        
        // Only ADMIN can use this endpoint
        if (currentUser.role !== UserRole.ADMIN) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'Access Denied - Administrator Privileges Required',
                error: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Get user data for audit logging before deletion
        const userToDelete = await this.usersService.findUserById(targetUserId);
        let profileToDelete: any = {};
        try {
            profileToDelete = (await this.usersService.getProfile(targetUserId)) || {};
        } catch (error) {
            // Ignore missing profile to allow deletion
        }
        
        await this.usersService.deleteUser(targetUserId);
        
        // Log user deletion audit
        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'users',
                recordId: targetUserId,
                action: 'DELETE',
                oldValues: {
                    email: userToDelete?.email || null,
                    first_name: userToDelete?.first_name || null,
                    last_name: userToDelete?.last_name || null,
                    role: userToDelete?.role || null,
                    display_name: profileToDelete?.display_name || null,
                    company_name: profileToDelete?.company_name || null
                },
                changedByUserId: currentUser.id,
                changeReason: `ADMIN deleted user`,
                ipAddress,
                userAgent
            });
        } catch (auditError) {
            console.error('Failed to log user deletion audit:', auditError);
        }
        
        return {
            message: 'User deleted successfully by administrator',
            deletedBy: currentUser.id,
            deletedAt: new Date().toISOString(),
            deletedUserId: targetUserId
        };
    }
}
