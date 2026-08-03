import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BCRYPT_SALT_ROUNDS, PASSWORD_RESET_TOKEN_BYTES, PASSWORD_RESET_TOKEN_EXPIRY_MS } from '../common/constants/auth.constants';
import { RegisterDto } from '../dto/auth.dto';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../interfaces/auth.interface';
import { AuthUser, ForgotPasswordResponse, LoginResponse, MessageResponse } from '../interfaces/auth.interface';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.usersService.findByEmail(email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user.id);
  }

  async register(dto: RegisterDto): Promise<LoginResponse> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.createWorker({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    await this.walletService.ensureWalletForWorker(user.id);

    return this.issueSession(user.id);
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub, true);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueSession(user.id);
  }

  async logout(refreshToken: string): Promise<MessageResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findById(payload.sub, true);
    if (!user || !user.refreshTokenHash) {
      return { message: 'Logged out' };
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.usersService.updateRefreshTokenHash(user.id, null);
    return { message: 'Logged out' };
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const user = await this.usersService.findByEmail(email, true);
    if (!user) {
      return { message: 'If the account exists, a reset token has been generated', resetToken: null };
    }

    const resetToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);
    await this.usersService.updatePasswordResetToken(user.id, resetTokenHash, expiresAt);

    return {
      message: 'Password reset token generated',
      resetToken,
    };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<MessageResponse> {
    const user = await this.findUserByResetToken(resetToken);
    if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const tokenMatches = await bcrypt.compare(resetToken, user.passwordResetTokenHash);
    if (!tokenMatches || user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.usersService.updatePasswordHash(user.id, passwordHash);
    await this.usersService.updatePasswordResetToken(user.id, null, null);
    await this.usersService.updateRefreshTokenHash(user.id, null);

    return { message: 'Password reset successfully' };
  }

  private async issueSession(userId: number): Promise<LoginResponse> {
    const user = await this.usersService.findById(userId, true);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(user),
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findUserByResetToken(resetToken: string) {
    const users = await this.usersService.findUsersWithResetSecrets();
    for (const user of users) {
      if (!user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
        continue;
      }

      const tokenMatches = await bcrypt.compare(resetToken, user.passwordResetTokenHash);
      if (tokenMatches && user.passwordResetTokenExpiresAt.getTime() >= Date.now()) {
        return user;
      }
    }

    return null;
  }

  private toAuthUser(user: { id: number; email: string; firstName: string; lastName: string; role: AuthUser['role'] }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }
}
