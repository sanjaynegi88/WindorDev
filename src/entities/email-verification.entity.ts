import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  otp_hash: string; // bcrypt hash of the OTP

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ default: false })
  verified: boolean;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: 0 })
  resend_count: number;

  @CreateDateColumn()
  created_at: Date;
}
