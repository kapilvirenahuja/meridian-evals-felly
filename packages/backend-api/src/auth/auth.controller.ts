import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Redirect,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { LoginDto, LogoutDto, RefreshDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
  ): Promise<{ userId: string; email: string; verificationToken: string }> {
    const clientIp = request.ip || '0.0.0.0';
    return this.authService.register(dto, clientIp);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ success: boolean }> {
    return this.authService.verifyEmail(dto.token);
  }

  @Get('social/google')
  @Redirect('', 302)
  async socialGoogle(): Promise<{ url: string }> {
    const result = await this.authService.socialLogin('google');
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3001';
    const url = `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    return { url };
  }

  @Get('social/apple')
  @Redirect('', 302)
  async socialApple(): Promise<{ url: string }> {
    const result = await this.authService.socialLogin('apple');
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3001';
    const url = `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`;
    return { url };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const clientIp = request.ip || '0.0.0.0';
    return this.authService.login(dto, clientIp);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: LogoutDto,
    @Req() request: FastifyRequest,
  ): Promise<{ success: boolean }> {
    const clientIp = request.ip || '0.0.0.0';
    await this.authService.logout(dto.refreshToken, clientIp);
    return { success: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async me(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ id: string; email: string; role: string; status: string }> {
    return this.authService.getMe(user.sub);
  }
}
