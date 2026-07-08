import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../entities/membership.entity';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { UserRole } from '../entities/user.entity';

@Injectable()
export class MembershipsService {
    constructor(
        @InjectRepository(Membership)
        private membershipRepository: Repository<Membership>,
    ) {}

    private isAdmin(userRole?: string): boolean {
        return userRole === UserRole.ADMIN;
    }

    async create(createMembershipDto: CreateMembershipDto, userRole: string): Promise<Membership> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can create memberships');
        }

        // Check if membership name already exists
        const existingMembership = await this.membershipRepository.findOne({
            where: { membership_name: createMembershipDto.membership_name }
        });

        if (existingMembership) {
            throw new BadRequestException('Membership with this name already exists');
        }

        const membership = this.membershipRepository.create(createMembershipDto);
        return await this.membershipRepository.save(membership);
    }

    async findAll(): Promise<Membership[]> {
        return await this.membershipRepository.find({
            order: { created_at: 'DESC' }
        });
    }

    async findOne(id: string): Promise<Membership> {
        const membership = await this.membershipRepository.findOne({
            where: { id }
        });

        if (!membership) {
            throw new NotFoundException(`Membership with ID ${id} not found`);
        }

        return membership;
    }

    async update(id: string, updateMembershipDto: UpdateMembershipDto, userRole: string): Promise<Membership> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can update memberships');
        }

        const membership = await this.findOne(id);

        // Check if new membership name already exists (if name is being updated)
        if (updateMembershipDto.membership_name && updateMembershipDto.membership_name !== membership.membership_name) {
            const existingMembership = await this.membershipRepository.findOne({
                where: { membership_name: updateMembershipDto.membership_name }
            });

            if (existingMembership) {
                throw new BadRequestException('Membership with this name already exists');
            }
        }

        await this.membershipRepository.update(id, updateMembershipDto);
        return await this.findOne(id);
    }

    async remove(id: string, userRole: string): Promise<void> {
        if (!this.isAdmin(userRole)) {
            throw new BadRequestException('Only administrators can delete memberships');
        }

        const membership = await this.findOne(id);
        await this.membershipRepository.remove(membership);
    }
}