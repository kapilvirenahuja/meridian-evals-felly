import { Injectable } from '@nestjs/common';
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
}
