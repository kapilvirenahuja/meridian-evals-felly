import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

@Module({
  imports: [PrismaModule, AuthModule, forwardRef(() => MarketplaceModule)],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
  exports: [AdminService],
})
export class AdminModule {}
