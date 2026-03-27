import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';

interface CreateUserData {
  email: string;
  passwordHash: string;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createUserWithMenteeProfile(data: CreateUserData) {
    return this.userRepository.createUserWithMenteeProfile(data);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string) {
    return this.userRepository.findById(id);
  }

  async getMe(
    userId: string,
  ): Promise<{ id: string; email: string; role: string; status: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }
}
