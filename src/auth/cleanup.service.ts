import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TempUser } from '../entities/temp-user.entity';
import { EmailVerification } from '../entities/email-verification.entity';
import { User } from '../entities/user.entity';
import * as admin from 'firebase-admin';
import { Inject } from '@nestjs/common';
import { FIREBASE_ADMIN_INJECT } from '../firebase/firebase.module';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @Inject(FIREBASE_ADMIN_INJECT)
    private firebaseAdmin: admin.app.App,
    @InjectRepository(TempUser)
    private tempUserRepository: Repository<TempUser>,
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Cron('*/3 * * * *') // every 3 minutes
  async handleCleanup() {
    try {
      const now = new Date();
      
      // Clean up expired temp users and email verifications
      const tempDelete = await this.tempUserRepository.delete({ expires_at: LessThan(now) } as any);
      const verDelete = await this.emailVerificationRepository.delete({ expires_at: LessThan(now) } as any);
      
      // Clean up users who didn't complete forms within 10 minutes of creation
      // Find users created more than 10 minutes ago without a completed form
      // EXCLUDE admin users and sub-accounts from cleanup
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      const expiredUsers = await this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.profile', 'profile')
        .leftJoin('user.roleEntity', 'role')
        .leftJoin('forms', 'form', 'form.user_id = user.id')
        .where('user.created_at < :tenMinutesAgo', { tenMinutesAgo })
        .andWhere('form.id IS NULL') // No form exists
        .andWhere('role.role_name != :adminRole', { adminRole: 'ADMIN' }) // Not admin
        .andWhere('user.sub_account = false') // Not sub-account
        .getMany();
      
      let userDeleteCount = 0;
      for (const user of expiredUsers) {
        try {
          // Delete from Firebase first
          if (user.firebase_uid) {
            await this.firebaseAdmin.auth().deleteUser(user.firebase_uid);
          }
          // Then delete from database
          await this.userRepository.delete(user.id);
          userDeleteCount++;
        } catch (err: any) {
          this.logger.warn(`Failed to delete expired user ${user.id}: ${err.message}`);
        }
      }
      
      this.logger.log(`Cleanup completed: temp ${tempDelete.affected || 0}, verifications ${verDelete.affected || 0}, expired users ${userDeleteCount}`);
    } catch (err: any) {
      this.logger.error('Cleanup failed: ' + err?.message);
    }
  }
}
