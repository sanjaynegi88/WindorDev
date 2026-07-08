import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComponentImageCategory } from '../entities/component-image-category.entity';
import { ComponentImageCategoriesService } from './component-image-categories.service';
import { ComponentImageCategoriesController, ComponentImageCategoriesPublicController, ComponentImageCategoriesAuthController } from './component-image-categories.controller';

@Module({
    imports: [TypeOrmModule.forFeature([ComponentImageCategory])],
    controllers: [ComponentImageCategoriesPublicController, ComponentImageCategoriesAuthController, ComponentImageCategoriesController],
    providers: [ComponentImageCategoriesService],
    exports: [ComponentImageCategoriesService],
})
export class ComponentImageCategoriesModule {}
