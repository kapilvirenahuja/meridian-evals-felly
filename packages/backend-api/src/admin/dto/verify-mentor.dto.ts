import { IsString, MinLength } from 'class-validator';

export class RejectMentorDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
