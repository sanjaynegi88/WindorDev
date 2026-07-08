import { IsInt, Min, IsNotEmpty } from 'class-validator';

export class PurchaseAdditionalUsersDto {
    @IsInt()
    @Min(1)
    @IsNotEmpty()
    numberOfUsers: number;
}
