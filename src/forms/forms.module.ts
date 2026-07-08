import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { UserForm } from '../entities/form.entity';
import { User } from '../entities/user.entity';
import { ServiceProvided } from '../entities/service-provided.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserForm, User, ServiceProvided])
    ],
    controllers: [FormsController],
    providers: [FormsService],
    exports: [FormsService]
})
export class FormsModule {}
