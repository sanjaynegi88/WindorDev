import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { User, UserRole } from '../entities/user.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import * as admin from 'firebase-admin';

@Injectable()
export class RolesService {
    constructor(
        @InjectRepository(Role)
        private roleRepository: Repository<Role>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async getRolesByAuth(authorization: string): Promise<Role[]> {
        try {
            // Extract token from Bearer header
            const token = authorization.replace('Bearer ', '');
            
            // Verify Firebase token
            const decodedToken = await admin.auth().verifyIdToken(token);
            
            // Look up user in database by firebase_uid
            const user = await this.userRepository.findOne({
                where: { firebase_uid: decodedToken.uid },
                relations: ['roleEntity']
            });
            
            // If user not found or no role, return public roles
            if (!user || !user.role) {
                return this.getPublicRoles();
            }
            
            // If admin, return all roles
            if (user.role === UserRole.ADMIN) {
                return this.roleRepository.find({ order: { created_at: 'DESC' } });
            }
            
            // For non-admin authenticated users, return public roles
            return this.getPublicRoles();
        } catch (error) {
            // If token verification fails, return public roles
            return this.getPublicRoles();
        }
    }

    async getPublicRoles(): Promise<Role[]> {
        return this.roleRepository.find({
            where: { is_public: true },
            order: { role_name: 'ASC' },
        });
    }

    async create(dto: CreateRoleDto): Promise<Role> {
        const existing = await this.roleRepository.findOne({
            where: { role_name: dto.role_name },
        });
        if (existing) {
            throw new BadRequestException(`Role "${dto.role_name}" already exists`);
        }
        const role = this.roleRepository.create({ 
            role_name: dto.role_name,
            is_public: dto.is_public ?? false
        });
        return this.roleRepository.save(role);
    }

    async findAll(id?: string): Promise<Role | Role[]> {
        if (id) {
            const role = await this.roleRepository.findOne({ where: { id } });
            if (!role) {
                throw new NotFoundException(`Role with ID "${id}" not found`);
            }
            return role;
        }
        return this.roleRepository.find({ order: { created_at: 'DESC' } });
    }

    async update(id: string, dto: UpdateRoleDto): Promise<Role> {
        const role = await this.roleRepository.findOne({ where: { id } });
        if (!role) {
            throw new NotFoundException(`Role with ID "${id}" not found`);
        }

        const duplicate = await this.roleRepository.findOne({
            where: { role_name: dto.role_name },
        });
        if (duplicate && duplicate.id !== id) {
            throw new BadRequestException(`Role "${dto.role_name}" already exists`);
        }

       if (dto.role_name !== undefined) {
  role.role_name = dto.role_name;
}
        if (dto.is_public !== undefined) {
            role.is_public = dto.is_public;
        }
        return this.roleRepository.save(role);
    }

    async remove(id: string): Promise<void> {
        const role = await this.roleRepository.findOne({ where: { id } });
        if (!role) {
            throw new NotFoundException(`Role with ID "${id}" not found`);
        }
        if (role.role_name.toUpperCase() === 'ADMIN') {
            throw new BadRequestException('The ADMIN role cannot be deleted');
        }
        await this.roleRepository.remove(role);
    }
}
