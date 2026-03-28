import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UserModule,
    AdminModule,
    MarketplaceModule,
  ],
})
export class AppModule {}
