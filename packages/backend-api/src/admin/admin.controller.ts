import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UploadArtefactDto } from './dto/upload-artefact.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('ping')
  @HttpCode(HttpStatus.OK)
  ping(): { status: string } {
    return { status: 'ok' };
  }

  @Post('mentors')
  @HttpCode(HttpStatus.CREATED)
  async createMentor(@Body() dto: CreateMentorDto) {
    return this.adminService.createMentor(dto);
  }

  @Post('mentors/:id/artefacts')
  @HttpCode(HttpStatus.CREATED)
  async uploadArtefact(@Param('id') id: string, @Body() dto: UploadArtefactDto) {
    return this.adminService.uploadArtefact(id, dto);
  }
}
