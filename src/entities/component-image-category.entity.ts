import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('component_image_categories')
export class ComponentImageCategory {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50, name: 'component_type' })
    component_type: string;

    @Column({ type: 'varchar', length: 100, name: 'display_name', nullable: true })
    display_name: string;

    @Column({ type: 'varchar', length: 100, name: 'category_name' })
    category_name: string;

    @CreateDateColumn({ name: 'created_at' })
    created_at: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at: Date;
}
