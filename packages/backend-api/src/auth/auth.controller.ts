import { Body, Controller, Get, HttpCode, HttpStatus, Post, Redirect, Req } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

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
}
