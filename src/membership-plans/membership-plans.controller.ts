import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query,
    UseGuards, 
    Req, 
    HttpStatus,
    ForbiddenException,
    NotFoundException,
    BadRequestException 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MembershipPlansService } from './membership-plans.service';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { UpdateMembershipPlanDto } from './dto/update-membership-plan.dto';
import { UpdateAutoRenewalDto } from './dto/update-auto-renewal.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { validateUUID } from '../common/utils/uuid-validator.util';
import { AuditService } from '../audit/audit.service';

@Controller('api/membership-plans')
@UseGuards(AuthGuard('firebase-jwt'))
export class MembershipPlansController {
    constructor(
        private readonly membershipPlansService: MembershipPlansService,
        private readonly auditService: AuditService
    ) {}

    private throwAdminOnlyError(userRole: string, endpoint: string) {
        throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            message: 'Access Denied - Administrator Privileges Required',
            error: 'INSUFFICIENT_PERMISSIONS',
            details: {
                requiredRole: 'ADMIN',
                currentRole: userRole,
                endpoint: endpoint,
                reason: 'This endpoint is restricted to administrators only',
                solution: 'Contact your system administrator for access'
            }
        });
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async create(@Body() createMembershipPlanDto: CreateMembershipPlanDto, @Req() req: any) {
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'POST /api/membership-plans');
        }

        try {
            const membershipPlan = await this.membershipPlansService.create(createMembershipPlanDto, req.user.role);
            
            // Log admin membership plan creation
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'membership_plans',
                    recordId: membershipPlan.id,
                    action: 'CREATE',
                    newValues: {
                        name: membershipPlan.name,
                        description: membershipPlan.description,
                        monthly_amount: membershipPlan.monthlyAmount,
                        yearly_amount: membershipPlan.yearlyAmount,
                        created_by_admin: req.user.id
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin created new membership plan',
                    ipAddress,
                    userAgent
                });
                
                console.log('ADMIN MEMBERSHIP PLAN CREATE AUDIT:', {
                    planId: membershipPlan.id,
                    planName: membershipPlan.name,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log membership plan creation audit:', auditError);
            }
            
            return {
                data: membershipPlan,
                message: 'Membership plan created successfully',
                createdBy: req.user.id,
                createdAt: new Date().toISOString()
            };
        } catch (error: any) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'POST /api/membership-plans');
            }
            throw error;
        }
    }

    @Get()
    async findAll(@Req() req: any, @Query('id') id?: string, @Query('role') role?: string) {
        if (id) {
            validateUUID(id, 'membership plan id');
            
            const membershipPlan = await this.membershipPlansService.findOne(id);
            return {
                data: membershipPlan,
                message: 'Membership plan retrieved successfully'
            };
        }
        
        const membershipPlans = await this.membershipPlansService.findAll(req.user.role, role);
        
        if (membershipPlans.length === 0) {
            return {
                data: [],
                message: 'No membership plans found.',
                total: 0
            };
        }
        
        return {
            data: membershipPlans,
            message: `Found ${membershipPlans.length} membership plans`,
            total: membershipPlans.length
        };
    }

    // User subscription API - create subscription AND payment session
    @Post('subscribe')
    async subscribe(@Body() body: { 
        plan_id: string, 
        billing_cycle: 'monthly' | 'annually'
    }, @Req() req: any) {
        validateUUID(body.plan_id, 'plan id');

        const result = await this.membershipPlansService.subscribe(req.user.id, body.plan_id, body.billing_cycle);

        if (!result.checkoutUrl) {
            return {
                data: { subscription: result.subscription },
                message: 'Free plan activated successfully.'
            };
        }

        return {
            data: {
                subscription: result.subscription,
                checkout_session: { url: result.checkoutUrl }
            },
            message: 'Subscription created. Complete payment to activate.'
        };
    }

    @Get('my-subscription')
    async getMySubscription(@Req() req: any) {
        const subscription = await this.membershipPlansService.getMySubscription(req.user.id);
        return {
            data: subscription,
            message: subscription ? 'Subscription retrieved successfully' : 'No active subscription found'
        };
    }

    @Get('payment-status/:subscriptionId')
    async getPaymentStatus(@Param('subscriptionId') subscriptionId: string, @Req() req: any) {
        validateUUID(subscriptionId, 'subscription id');
        
        const subscription = await this.membershipPlansService.getSubscriptionPaymentStatus(subscriptionId, req.user.id);
        return {
            data: subscription,
            message: 'Payment status retrieved successfully'
        };
    }

    @Get('debug/:subscriptionId')
    async debugSubscription(@Param('subscriptionId') subscriptionId: string, @Req() req: any) {
        validateUUID(subscriptionId, 'subscription id');
        
        const status = await this.membershipPlansService.getSubscriptionPaymentStatus(subscriptionId, req.user.id);
        const dbSubscription = await this.membershipPlansService.getMySubscription(req.user.id);
        
        return {
            data: {
                ...status,
                dbSubscription
            },
            message: 'Subscription debug info retrieved'
        };
    }

    @Post('sync-membership-status')
    async syncMembershipStatus(@Req() req: any) {
        const result = await this.membershipPlansService.syncUserMembershipStatus(req.user.id);
        
        return {
            data: result,
            message: 'Membership status synchronized'
        };
    }

    @Get('subscription-status')
    async getSubscriptionStatus(@Req() req: any) {
        const subscription = await this.membershipPlansService.getMySubscription(req.user.id);
        
        return {
            data: subscription,
            message: subscription ? 'Subscription found' : 'No subscription found'
        };
    }

    @Get('manual-activate/:subscriptionId')
    async manualActivate(@Param('subscriptionId') subscriptionId: string, @Req() req: any) {
        validateUUID(subscriptionId, 'subscription id');
        
        const subscription = await this.membershipPlansService.getMySubscription(req.user.id);
        
        if (!subscription || subscription.id !== subscriptionId) {
            throw new NotFoundException('Subscription not found');
        }
        
        if (subscription.status === 'ACTIVE') {
            return {
                message: 'Subscription is already active',
                data: subscription
            };
        }
        
        subscription.status = 'ACTIVE';
        const updated = await this.membershipPlansService['subscriptionRepository'].save(subscription);
        
        await this.membershipPlansService['userProfileRepository'].update(
            { user_id: req.user.id },
            { 
                current_subscription_id: subscription.id,
                has_membership: true
            }
        );
        
        return {
            message: 'Subscription manually activated for testing',
            data: updated
        };
    }

    @Post('cleanup-abandoned')
    async cleanupAbandonedSubscriptions(@Req() req: any) {
        const result = await this.membershipPlansService.cleanupAbandonedSubscriptions(req.user.id);
        return {
            data: result,
            message: `Cleaned up ${result.cleaned} abandoned subscription(s)`
        };
    }

    @Put('cancel')
    async cancelMembership(@Req() req: any) {
        await this.membershipPlansService.cancelSubscription(req.user.id);
        return {
            message: 'Membership plan cancelled successfully',
            cancelledAt: new Date().toISOString()
        };
    }

    // Auto-renewal toggle endpoint
    @Put('auto-renewal')
    async updateAutoRenewal(@Body() updateAutoRenewalDto: UpdateAutoRenewalDto, @Req() req: any) {
        const result = await this.membershipPlansService.updateAutoRenewal(
            req.user.id, 
            updateAutoRenewalDto.autoRenewalEnabled
        );
        
        return {
            data: result,
            message: 'Auto-renewal setting updated successfully'
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        validateUUID(id, 'membership plan id');
        
        const membershipPlan = await this.membershipPlansService.findOne(id);
        return {
            data: membershipPlan,
            message: 'Membership plan retrieved successfully'
        };
    }


    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async update(
        @Param('id') id: string, 
        @Body() updateMembershipPlanDto: UpdateMembershipPlanDto, 
        @Req() req: any
    ) {
        validateUUID(id, 'membership plan id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'PUT /api/membership-plans/:id');
        }

        try {
            const oldPlan = await this.membershipPlansService.findOne(id);
            const membershipPlan = await this.membershipPlansService.update(id, updateMembershipPlanDto, req.user.role);
            
            // Log admin membership plan update
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'membership_plans',
                    recordId: id,
                    action: 'UPDATE',
                    oldValues: {
                        name: oldPlan.name,
                        description: oldPlan.description,
                        monthly_amount: oldPlan.monthlyAmount,
                        yearly_amount: oldPlan.yearlyAmount
                    },
                    newValues: {
                        name: membershipPlan.name,
                        description: membershipPlan.description,
                        monthly_amount: membershipPlan.monthlyAmount,
                        yearly_amount: membershipPlan.yearlyAmount
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin updated membership plan',
                    ipAddress,
                    userAgent
                });
                
                console.log('ADMIN MEMBERSHIP PLAN UPDATE AUDIT:', {
                    planId: id,
                    planName: membershipPlan.name,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log membership plan update audit:', auditError);
            }
            
            return {
                data: membershipPlan,
                message: 'Membership plan updated successfully',
                updatedBy: req.user.id,
                updatedAt: new Date().toISOString()
            };
        } catch (error: any) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'PUT /api/membership-plans/:id');
            }
            throw error;
        }
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async remove(@Param('id') id: string, @Req() req: any) {
        validateUUID(id, 'membership plan id');
        
        if (req.user.role !== UserRole.ADMIN) {
            this.throwAdminOnlyError(req.user.role, 'DELETE /api/membership-plans/:id');
        }

        try {
            const oldPlan = await this.membershipPlansService.findOne(id);
            await this.membershipPlansService.remove(id, req.user.role);
            
            // Log admin membership plan deletion
            try {
                const { ipAddress, userAgent } = this.auditService.getRequestMetadata(req);
                await this.auditService.logAdminAction({
                    tableName: 'membership_plans',
                    recordId: id,
                    action: 'DELETE',
                    oldValues: {
                        name: oldPlan.name,
                        description: oldPlan.description,
                        monthly_amount: oldPlan.monthlyAmount,
                        yearly_amount: oldPlan.yearlyAmount
                    },
                    changedByUserId: req.user.id,
                    changeReason: 'Admin deleted membership plan',
                    ipAddress,
                    userAgent
                });
                
                console.log('ADMIN MEMBERSHIP PLAN DELETE AUDIT:', {
                    planId: id,
                    planName: oldPlan.name,
                    adminId: req.user.id,
                    timestamp: new Date().toISOString(),
                    ipAddress
                });
            } catch (auditError) {
                console.error('Failed to log membership plan deletion audit:', auditError);
            }
            
            return {
                message: 'Membership plan deleted successfully',
                deletedBy: req.user.id,
                deletedAt: new Date().toISOString(),
                deletedMembershipPlanId: id
            };
        } catch (error: any) {
            if (error.message?.includes('Only administrators')) {
                this.throwAdminOnlyError(req.user.role, 'DELETE /api/membership-plans/:id');
            }
            throw error;
        }
    }
}