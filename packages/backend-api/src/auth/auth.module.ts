import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AUTH_ADAPTER_TOKEN } from '../common/constants';
import { UserModule } from '../user/user.module';
import { MockAuthAdapter } from './adapters/mock-auth.adapter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: AUTH_ADAPTER_TOKEN,
      useClass: MockAuthAdapter,
      // E11: change to: useClass: KeyCloakAuthAdapter
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    PassportModule,
    { provide: AUTH_ADAPTER_TOKEN, useClass: MockAuthAdapter },
  ],
})
export class AuthModule {}
