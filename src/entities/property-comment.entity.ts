import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Property } from './property.entity';
import { User } from './user.entity';

@Entity('property_comments')
export class PropertyComment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    property_id: string;

    @ManyToOne(() => Property)
    @JoinColumn({ name: 'property_id' })
    property: Property;

    @Column()
    user_id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column('text')
    comment: string;

    @CreateDateColumn()
    created_at: Date;
}