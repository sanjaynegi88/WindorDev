import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Brand } from '../entities/brand.entity';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { Report } from '../entities/report.entity';

@Injectable()
export class CountsService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Brand)
        private brandRepository: Repository<Brand>,
        @InjectRepository(City)
        private cityRepository: Repository<City>,
        @InjectRepository(State)
        private stateRepository: Repository<State>,
        @InjectRepository(Report)
        private reportRepository: Repository<Report>,
    ) {}

    async getCounts(userId: string, userRole: string, isSubAccount: boolean) {
        // If user is ADMIN, return all counts
        if (userRole === UserRole.ADMIN) {
            return await this.getAllCounts();
        }
        
        // If user is PROPERTY_OWNER, return count of properties with reports
        if (userRole === UserRole.PROPERTY_OWNER) {
            return await this.getPropertyOwnerReportsCount(userId);
        }

        // Block sub-account users for other roles
        if (isSubAccount === true) {
            throw new ForbiddenException('Sub-account users cannot access this');
        }
        
        // If user is CITY_INSPECTOR with sub_account = false, return only sub-users count
        if (userRole === UserRole.CITY_INSPECTOR && !isSubAccount) {
            return await this.getCityInspectorSubUsersCounts(userId);
        }
        
        // If user is INSURANCE_COMPANY with sub_account = false, return only sub-users count
        if (userRole === UserRole.INSURANCE_COMPANY && !isSubAccount) {
            return await this.getInsuranceCompanySubUsersCounts(userId);
        }
        
        // If user is CONTRACTOR, return count of properties with reports they created
        if ((userRole === UserRole.CONTRACTOR || userRole === UserRole.MANUFACTURER)) {
            return await this.getContractorReportsCount(userId);
        }
        
        // For other cases, return empty or restricted data
        throw new ForbiddenException('Access restricted for this user type');
    }

    private async getAllCounts() {
        // Get user counts by role
        const [
            adminCount,
            cityInspectorCount,
            insuranceCompanyCount,
            contractorCount,
            propertyOwnerCount,
            totalUsersCount
        ] = await Promise.all([
            this.userRepository.count({ where: { role: UserRole.ADMIN } }),
            this.userRepository.count({ where: { role: UserRole.CITY_INSPECTOR } }),
            this.userRepository.count({ where: { role: UserRole.INSURANCE_COMPANY } }),
            this.userRepository.count({ where: { role: UserRole.CONTRACTOR } }),
            this.userRepository.count({ where: { role: UserRole.PROPERTY_OWNER } }),
            this.userRepository.count()
        ]);

        // Get other entity counts
        const [
            brandsCount,
            citiesCount,
            statesCount,
            propertiesWithReportsCount
        ] = await Promise.all([
            this.brandRepository.count(),
            this.cityRepository.count(),
            this.stateRepository.count(),
            this.getPropertiesWithReportsCount()
        ]);

        return {
            users: {
                total: totalUsersCount,
                byRole: {
                    admin: adminCount,
                    cityInspector: cityInspectorCount,
                    insuranceCompany: insuranceCompanyCount,
                    contractor: contractorCount,
                    propertyOwner: propertyOwnerCount
                }
            },
            entities: {
                brands: brandsCount,
                cities: citiesCount,
                states: statesCount,
                propertiesWithReports: propertiesWithReportsCount
            }
        };
    }

    private async getPropertiesWithReportsCount(): Promise<number> {
        // Count distinct properties that have reports generated
        const result = await this.reportRepository
            .createQueryBuilder('report')
            .select('COUNT(DISTINCT report.property_id)', 'count')
            .getRawOne();
        
        return parseInt(result.count, 10) || 0;
    }

    private async getCityInspectorSubUsersCounts(parentId: string) {
        // Get count of sub-users for this city inspector
        const subUsersCount = await this.userRepository.count({
            where: { 
                parent_id: parentId,
                sub_account: true,
                role: UserRole.CITY_INSPECTOR
            }
        });

        return {
            subUsers: {
                total: subUsersCount,
                role: 'CITY_INSPECTOR'
            }
        };
    }

    private async getInsuranceCompanySubUsersCounts(parentId: string) {
        // Get count of sub-users for this insurance company
        const subUsersCount = await this.userRepository.count({
            where: { 
                parent_id: parentId,
                sub_account: true,
                role: UserRole.INSURANCE_COMPANY
            }
        });

        return {
            subUsers: {
                total: subUsersCount,
                role: 'INSURANCE_COMPANY'
            }
        };
    }

    private async getContractorReportsCount(userId: string) {
        // Count properties created by this contractor that have reports generated
        const result = await this.reportRepository
            .createQueryBuilder('report')
            .innerJoin('report.property', 'property')
            .where('property.created_by = :userId', { userId })
            .select('COUNT(DISTINCT report.property_id)', 'count')
            .getRawOne();
        
        const count = parseInt(result.count, 10) || 0;

        return {
            propertiesWithReports: count
        };
    }

    private async getPropertyOwnerReportsCount(userId: string) {
        // Count properties owned by this user that have reports generated
        const result = await this.reportRepository
            .createQueryBuilder('report')
            .innerJoin('report.property', 'property')
            .where('property.property_owner_id = :userId', { userId })
            .select('COUNT(DISTINCT report.property_id)', 'count')
            .getRawOne();
        
        const count = parseInt(result.count, 10) || 0;

        return {
            propertiesWithReports: count
        };
    }
}