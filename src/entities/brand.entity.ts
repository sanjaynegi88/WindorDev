import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum BrandCategory {
    ROOFING = 'ROOFING',
    SIDING = 'SIDING',
    WINDOW_DOOR = 'WINDOW_DOOR',
    WINDOWS = 'WINDOWS',
    DOORS = 'DOORS',
    GARAGE_DOORS = 'GARAGE_DOORS',
}

@Entity('brands')
export class Brand {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    name: string;

    @Column({
        type: 'varchar',
        length: 100,
    })
    category: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}