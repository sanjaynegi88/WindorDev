import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000, { message: 'Comment cannot exceed 1000 characters' })
    comment: string;
}