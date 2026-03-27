import { IsIn, IsString } from 'class-validator';

export class UploadArtefactDto {
  @IsString()
  @IsIn(['LINKEDIN_URL', 'PORTFOLIO_URL', 'DOCUMENT'])
  type!: string;

  @IsString()
  value!: string;
}
