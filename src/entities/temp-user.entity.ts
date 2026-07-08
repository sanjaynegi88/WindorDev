import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('temp_registrations')
export class TempUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column({ nullable: true })
  firebase_uid?: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'uuid' })
  role_id: string;

  @Column({ type: 'uuid', nullable: true })
  state_id?: string;

  @Column({ type: 'uuid', nullable: true })
  city_id?: string;

  @Column({ nullable: true })
  zip?: string;

  @Column({ nullable: true })
  company_address?: string;

  @Column({ nullable: true })
  website_url?: string;

  @Column({ nullable: true })
  license_number?: string;

  @Column({ nullable: true })
  mobile_phone?: string;

  @Column({ nullable: true })
  company_phone?: string;

  @Column({ nullable: true })
  property_address?: string;

  @Column({ type: 'timestamp', nullable: true })
  owner_date_start?: Date;

  @Column({ type: 'timestamp', nullable: true })
  owner_date_end?: Date;

  @Column({ type: 'json', nullable: true })
  service_types?: string[];

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  city_official?: string;

  @Column({ nullable: true })
  city_address?: string;

  @Column({ nullable: true })
  city_phone?: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ default: false })
  verified: boolean;
}
