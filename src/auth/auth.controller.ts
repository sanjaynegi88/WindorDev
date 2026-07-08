import { Controller, Get, Query, Post, Put, Delete, Body, Res, HttpStatus, ValidationPipe, UsePipes, UseGuards, Req, ForbiddenException, BadRequestException, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MembershipPlansService } from '../membership-plans/membership-plans.service';
import type { Response } from 'express';
import { RegisterDto, VerifyRegistrationDto, ResendOtpDto, LoginDto, RefreshTokenDto, CreateStaffDto, GoogleLoginDto, AdminCreateUserDto, AssignRoleDto, CompleteFormDto, AppleLoginDto } from './dto/auth.dto';
import { ForgotPasswordDto, VerifyOtpDto, ResetPasswordDto, ChangePasswordDto } from './dto/password-reset.dto';
import { AuthGuard } from '@nestjs/passport';
import { AdminAccessGuard } from './guards/admin.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';

@Controller('api/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly membershipPlansService: MembershipPlansService,
        private readonly auditService: AuditService,
    ) { }

    @Post('register')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
        try {
            const result = await this.authService.registerUser(registerDto as any);
            return res.status(HttpStatus.CREATED).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'Registration failed'
            });
        }
    }

    @Post('form/:userId')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async completeForm(@Param('userId') userId: string, @Body() formDto: CompleteFormDto, @Res() res: Response) {
        try {
            validateUUID(userId, 'user id');
            const result = await this.authService.completeUserForm(userId, formDto);
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'Form completion failed'
            });
        }
    }

    @Post('register/verify')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async verifyRegistration(@Body() verifyRegistrationDto: VerifyRegistrationDto, @Res() res: Response) {
        try {
            const result = await this.authService.verifyRegistrationOtp(verifyRegistrationDto.email, verifyRegistrationDto.otp);
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'OTP verification failed'
            });
        }
    }

    @Post('register/resend-otp')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async resendRegistrationOtp(@Body() resendOtpDto: ResendOtpDto, @Res() res: Response) {
        try {
            const result = await this.authService.resendRegistrationOtp(resendOtpDto.email);
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'OTP resend failed'
            });
        }
    }

    @Post('login')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async login(@Body() loginDto: LoginDto, @Res() res: Response, @Req() req: any) {
        try {
            const { email, password } = loginDto;
            const result = await this.authService.loginUser(email, password);

            // Log user login for all users
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'auth_events',
                recordId: result.userId, // Use database user ID
                action: 'LOGIN',
                newValues: {
                    email: result.email,
                    login_time: new Date(),
                    ip_address: ipAddress,
                    user_agent: userAgent
                },
                changedByUserId: result.userId, // Use database user ID
                changeReason: `${result.role} user logged in`,
                ipAddress,
                userAgent
            });

            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.UNAUTHORIZED;
            return res.status(status).json({
                error: 'Login failed',
                message: err.message
            });
        }
    }

    @Post('google')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async googleLogin(@Body() googleLoginDto: GoogleLoginDto, @Res() res: Response, @Req() req: any) {
        try {
            const { idToken } = googleLoginDto;
            const result = await this.authService.googleLogin(idToken);

            // Log Google login for all users
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'auth_events',
                recordId: result.userId,
                action: 'LOGIN',
                newValues: {
                    email: result.email,
                    login_time: new Date(),
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    login_method: 'google'
                },
                changedByUserId: result.userId,
                changeReason: `${result.role} user logged in via Google`,
                ipAddress,
                userAgent
            });

            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.UNAUTHORIZED;
            return res.status(status).json({
                error: 'Google login failed',
                message: err.message
            });
        }
    }

    @Post('apple')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async appleLogin(@Body() appleLoginDto: AppleLoginDto, @Res() res: Response, @Req() req: any) {
        try {
            const { idToken } = appleLoginDto;
            
            // Helpful for copying the token during development/testing
            console.log('\n--- APPLE LOGIN ATTEMPT ---');
            console.log('Received idToken:', idToken);
            console.log('---------------------------\n');

            const result = await this.authService.loginWithApple(idToken);

            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'auth_events',
                recordId: result.userId,
                action: 'LOGIN',
                newValues: {
                    email: result.email,
                    login_time: new Date(),
                    ip_address: ipAddress,
                    user_agent: userAgent,
                    login_method: 'apple'
                },
                changedByUserId: result.userId,
                changeReason: `${result.role || 'New'} user logged in via Apple`,
                ipAddress,
                userAgent
            });

            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.UNAUTHORIZED;
            return res.status(status).json({
                error: 'Apple login failed',
                message: err.message
            });
        }
    }

    @Post('admin/add-user')
    @UseGuards(AuthGuard('firebase-jwt'), AdminAccessGuard)
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async adminRegister(@Body() adminCreateUserDto: AdminCreateUserDto, @Req() req: any, @Res() res: Response) {
        try {
            const { email, password, first_name, last_name, role_id, city_id, company_name } = adminCreateUserDto as any;

            if (city_id) {
                validateUUID(city_id, 'city id');
            }

            // Fetch role information to validate required fields
            const role = await this.authService.getRoleById(role_id);
            if (!role) {
                throw new BadRequestException('Invalid role_id provided');
            }

            // Validate role-specific required fields before processing
            try {
                adminCreateUserDto.validateRoleRequiredFields(role.role_name);
            } catch (validationError: any) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    message: validationError.message,
                    error: 'Validation failed'
                });
            }

            const result: any = await this.authService.registerUser(adminCreateUserDto as any, false, req.user.id, true);

            if (result?.uid) {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'users',
                    recordId: result.uid,
                    action: 'USER_CREATE',
                    newValues: {
                        email,
                        first_name,
                        last_name,
                        role_id,
                        city_id,
                        company_name,
                        created_by_admin: req.user.id
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin created new user account',
                    ipAddress,
                    userAgent
                });
            }

            return res.status(HttpStatus.CREATED).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'Admin registration failed'
            });
        }
    }

    @Post('add-staff')
    @UseGuards(AuthGuard('firebase-jwt'))
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async addStaff(@Body() staffDto: CreateStaffDto, @Req() req: any, @Res() res: Response) {
        try {
            if (req.user.role !== UserRole.CITY_INSPECTOR && req.user.role !== UserRole.INSURANCE_COMPANY && req.user.role !== UserRole.CONTRACTOR) {
                throw new ForbiddenException('Only City Inspectors, Insurance Companies, and Contractors can add staff');
            }

            // Enforce max_users limit only for CONTRACTOR sub-accounts
            if (req.user.role === UserRole.CONTRACTOR) {
                const subCount = await this.usersService.countSubAccounts(req.user.id);
                const subscription = await this.membershipPlansService.getMySubscription(req.user.id);
                const maxUsers = subscription?.plan?.maxUsers ?? 0;
                const purchasedUsers = await this.membershipPlansService.getTotalPurchasedUsers(req.user.id);
                const totalAllowedUsers = maxUsers + purchasedUsers;
                
                if (totalAllowedUsers > 0 && subCount >= totalAllowedUsers) {
                    throw new ForbiddenException(`Maximum number of staff members reached (${totalAllowedUsers}). Please complete payment for additional users to add more staff.`);
                }
            }

            const { email, password, first_name, last_name } = staffDto;

            const registerObj: any = {
                email,
                password,
                first_name,
                last_name,
                role_id: req.user.role_id,
            };

            const result: any = await this.authService.registerUser(registerObj, true, req.user.id, true);

            if (result?.uid) {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'users',
                    recordId: result.uid,
                    action: 'USER_CREATE',
                    newValues: {
                        email,
                        first_name,
                        last_name,
                        role: req.user.role,
                        parent_id: req.user.id,
                        is_sub_account: true
                    },
                    changedByUserId: req.user.id,
                    changeReason: `${req.user.role} created new staff member`,
                    ipAddress,
                    userAgent
                });
            }

            return res.status(HttpStatus.CREATED).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.BAD_REQUEST;
            return res.status(status).json({
                message: err.message,
                error: 'Staff registration failed'
            });
        }
    }

    @Post('refresh-token')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Res() res: Response) {
        try {
            const { refresh_token } = refreshTokenDto;
            const result = await this.authService.refreshToken(refresh_token);
            return res.status(HttpStatus.OK).json(result);
        } catch (err: any) {
            const status = err.getStatus ? err.getStatus() : HttpStatus.UNAUTHORIZED;
            return res.status(status).json({
                message: err.message,
                error: 'Token refresh failed'
            });
        }
    }

    @Post('forgot-password')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto, @Req() req: any) {
        const result = await this.authService.forgotPassword(forgotPasswordDto.email);

        // Check if this is a user and log the security event for all users
        try {
            const user = await this.usersService.findUserByEmail(forgotPasswordDto.email);
            if (user) {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'auth_events',
                    recordId: user.id,
                    action: 'PASSWORD_FORGOT',
                    newValues: {
                        email: user.email,
                        forgot_password_time: new Date(),
                        ip_address: ipAddress,
                        user_agent: userAgent
                    },
                    changedByUserId: user.id,
                    changeReason: `${user.role} user initiated password reset process`,
                    ipAddress,
                    userAgent
                });
            }
        } catch (error) {
            // Ignore user lookup errors for security
        }

        return result;
    }

    @Post('verify-otp')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
        return await this.authService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp);
    }

    @Post('reset-password')
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: any) {
        const result = await this.authService.resetPassword(resetPasswordDto.reset_token, resetPasswordDto.newPassword);

        // Check if this is a user and log the security event for all users
        try {
            // We need to get the email from the reset token since result doesn't contain it
            // Let's get it from the password reset record
            const resetRecord = await this.authService.getPasswordResetByToken(resetPasswordDto.reset_token);
            if (resetRecord) {
                const user = await this.usersService.findUserByEmail(resetRecord.email);
                if (user) {
                    const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                    await this.auditService.logAdminAction({
                        tableName: 'auth_events',
                        recordId: user.id,
                        action: 'PASSWORD_RESET',
                        newValues: {
                            email: user.email,
                            password_reset_time: new Date(),
                            ip_address: ipAddress,
                            user_agent: userAgent
                        },
                        changedByUserId: user.id,
                        changeReason: `${user.role} user completed password reset process`,
                        ipAddress,
                        userAgent
                    });
                }
            }
        } catch (error) {
            // Ignore user lookup errors for security
        }

        return result;
    }

    @Post('change-password')
    @UseGuards(AuthGuard('firebase-jwt'))
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req: any) {
        // Get the current token to blacklist it
        const authHeader = req.headers.authorization;
        const currentToken = authHeader ? authHeader.split(' ')[1] : '';

        const result = await this.authService.changePassword(req.user.id, changePasswordDto.currentPassword, changePasswordDto.newPassword, currentToken);

        // Log password change for all users
        const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
        await this.auditService.logAdminAction({
            tableName: 'auth_events',
            recordId: req.user.id,
            action: 'PASSWORD_CHANGE',
            newValues: {
                email: req.user.email,
                password_change_time: new Date(),
                ip_address: ipAddress,
                user_agent: userAgent
            },
            changedByUserId: req.user.id,
            changeReason: `${req.user.role} user changed password while logged in`,
            ipAddress,
            userAgent
        });

        return result;
    }

    @Get('property-owners')
    @UseGuards(AuthGuard('firebase-jwt'))
    async getPropertyOwners(@Req() req: any, @Query('id') propertyOwnerId?: string) {
        if (propertyOwnerId) {
            validateUUID(propertyOwnerId, 'property owner id');
        }

        // Only Contractors can list property owners for this specific feature
        if (req.user.role !== UserRole.CONTRACTOR && req.user.role !== UserRole.MANUFACTURER && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Contractors, Manufacturers, and Admins can access the property owner list');
        }
        
        const owners = await this.usersService.getAllUsers({
            role: UserRole.PROPERTY_OWNER,
            id: propertyOwnerId
        });
        
        // If querying by ID, return single object instead of array
        if (propertyOwnerId && owners.data.length > 0) {
            return {
                data: owners.data[0], // Return single object
                total: owners.total
            };
        }
        
        return owners; // Return array for list queries
    }

    @Get('staff')
    @UseGuards(AuthGuard('firebase-jwt'), RolesGuard)
    @Roles(UserRole.CONTRACTOR, UserRole.CITY_INSPECTOR, UserRole.INSURANCE_COMPANY)
    async getStaff(@Req() req: any, @Query('id') staffId?: string) {
        if (staffId) {
            validateUUID(staffId, 'staff id');
        }

        const boss = await this.usersService.findUserById(req.user.id);
        if (!boss) {
            throw new BadRequestException('User not found');
        }

        const staff = await this.usersService.getStaffByParent(boss, staffId);

        return {
            data: staff,
            message: `Retrieved ${staff.length} staff member(s)`
        };
    }

    @Put('update-staff/:id')
    @UseGuards(AuthGuard('firebase-jwt'))
    @UseInterceptors(FileInterceptor('image'))
    async updateStaff(
        @Param('id') targetUserId: string,
        @Body() updateData: any,
        @UploadedFile() file: any,
        @Req() req: any
    ) {
        validateUUID(targetUserId, 'user id');
        
        const currentUser = req.user;
        
        // Only INSURANCE_COMPANY, CITY_INSPECTOR, and CONTRACTOR with sub_account=false can use this endpoint
        if (currentUser.sub_account || 
            (currentUser.role !== UserRole.INSURANCE_COMPANY && currentUser.role !== UserRole.CITY_INSPECTOR && currentUser.role !== UserRole.CONTRACTOR)) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'Access Denied - Only main Insurance Company, City Inspector, and Contractor accounts can manage staff',
                error: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Check if current user can manage the target user
        const canUpdate = await this.usersService.canManageUser(currentUser, targetUserId);
        
        if (!canUpdate.allowed) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: `Access Denied - ${currentUser.role} can only manage their sub-account users`,
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
        };
        
        const updatedUser = await this.usersService.updateUserWithProfile(targetUserId, processedDto, file);
        
        // Log staff update audit
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
                changeReason: `${currentUser.role} updated staff member information`,
                ipAddress,
                userAgent
            });
        } catch (auditError) {
            console.error('Failed to log staff update audit:', auditError);
        }
        
        return {
            data: updatedUser,
            message: 'Staff member updated successfully',
            updatedBy: currentUser.id,
            updatedAt: new Date().toISOString()
        };
    }

    @Delete('delete-staff/:id')
    @UseGuards(AuthGuard('firebase-jwt'))
    async deleteStaff(
        @Param('id') targetUserId: string,
        @Req() req: any
    ) {
        validateUUID(targetUserId, 'user id');
        
        const currentUser = req.user;
        
        // Only INSURANCE_COMPANY, CITY_INSPECTOR, and CONTRACTOR with sub_account=false can use this endpoint
        if (currentUser.sub_account || 
            (currentUser.role !== UserRole.INSURANCE_COMPANY && currentUser.role !== UserRole.CITY_INSPECTOR && currentUser.role !== UserRole.CONTRACTOR)) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: 'Access Denied - Only main Insurance Company, City Inspector, and Contractor accounts can manage staff',
                error: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Check if current user can manage the target user
        const canDelete = await this.usersService.canManageUser(currentUser, targetUserId);
        
        if (!canDelete.allowed) {
            throw new ForbiddenException({
                statusCode: HttpStatus.FORBIDDEN,
                message: `Access Denied - ${currentUser.role} can only manage their sub-account users`,
                error: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        
        // Get user data for audit logging before deletion
        const userToDelete = await this.usersService.findUserById(targetUserId);
        const profileToDelete = await this.usersService.getProfile(targetUserId);
        
        await this.usersService.deleteUser(targetUserId);
        
        // Log staff deletion audit
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
                changeReason: `${currentUser.role} deleted staff member`,
                ipAddress,
                userAgent
            });
        } catch (auditError) {
            console.error('Failed to log staff deletion audit:', auditError);
        }
        
        return {
            message: 'Staff member deleted successfully',
            deletedBy: currentUser.id,
            deletedAt: new Date().toISOString(),
            deletedUserId: targetUserId
        };
    }

    @Put('assign-role')
    @UseGuards(AuthGuard('firebase-jwt'))
    @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
    async assignRole(@Body() assignRoleDto: AssignRoleDto, @Req() req: any) {
        const result = await this.authService.assignRole(req.user.id, req.user.firebase_uid, assignRoleDto);

        try {
            const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
            await this.auditService.logAdminAction({
                tableName: 'users',
                recordId: req.user.id,
                action: 'UPDATE',
                newValues: { role: result.role },
                changedByUserId: req.user.id,
                changeReason: 'User assigned role after Google sign-in',
                ipAddress,
                userAgent
            });
        } catch (auditError) {
            console.error('Failed to log role assignment audit:', auditError);
        }

        return result;
    }

    @Post('logout')
    @UseGuards(AuthGuard('firebase-jwt'))
    async logout(@Req() req: any) {
        const authHeader = req.headers.authorization;
        const idToken = authHeader ? authHeader.split(' ')[1] : '';

        // Log user logout for all users
        const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
        await this.auditService.logAdminAction({
            tableName: 'auth_events',
            recordId: req.user.id,
            action: 'LOGOUT',
            newValues: {
                email: req.user.email,
                logout_time: new Date(),
                ip_address: ipAddress,
                user_agent: userAgent
            },
            changedByUserId: req.user.id,
            changeReason: `${req.user.role} user logged out`,
            ipAddress,
            userAgent
        });

        return await this.authService.logout(req.user.id, idToken);
    }
}