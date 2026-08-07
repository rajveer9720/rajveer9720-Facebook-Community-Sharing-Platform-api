import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { BCRYPT_SALT_ROUNDS, PASSWORD_RESET_TOKEN_BYTES, PASSWORD_RESET_TOKEN_EXPIRY_MS } from '../common/constants/auth.constants';
import { RegisterDto } from '../dto/auth.dto';
import { AdminsService } from '../admins/admins.service';
import { Admin } from '../admins/admin.entity';
import { WorkersService } from '../workers/workers.service';
import { Worker } from '../workers/worker.entity';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../interfaces/auth.interface';
import { AuthUser, ForgotPasswordResponse, LoginResponse, MessageResponse, StaffRoleSummary } from '../interfaces/auth.interface';
import { WalletService } from '../wallet/wallet.service';
import { RolesService } from '../roles/roles.service';
import { PermissionPair } from '../permissions/permission-catalog';

type Account = Admin | Worker;

@Injectable()
export class AuthService {
  constructor(
    private readonly adminsService: AdminsService,
    private readonly workersService: WorkersService,
    private readonly walletService: WalletService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const [admin, worker] = await Promise.all([
      this.adminsService.findByEmail(email, true),
      this.workersService.findByEmail(email, true),
    ]);
    const account = admin ?? worker;
    if (!account) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const role = admin ? UserRole.ADMIN : UserRole.WORKER;

    const passwordMatches = await bcrypt.compare(password, account.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(account, role);
  }

  async register(dto: RegisterDto): Promise<LoginResponse> {
    const [existingAdmin, existingWorker] = await Promise.all([
      this.adminsService.findByEmail(dto.email),
      this.workersService.findByEmail(dto.email),
    ]);
    if (existingAdmin || existingWorker) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const worker = await this.workersService.createWorker({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
    await this.walletService.ensureWalletForWorker(worker.id);

    return this.issueSession(worker, UserRole.WORKER);
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const account = await this.findAccountById(payload.sub, payload.role, true);
    if (!account || !account.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, account.refreshTokenHash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueSession(account, payload.role);
  }

  async logout(refreshToken: string): Promise<MessageResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const account = await this.findAccountById(payload.sub, payload.role, true);
    if (!account || !account.refreshTokenHash) {
      return { message: 'Logged out' };
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, account.refreshTokenHash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.updateRefreshTokenHash(account.id, payload.role, null);
    return { message: 'Logged out' };
  }

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    const [admin, worker] = await Promise.all([
      this.adminsService.findByEmail(email, true),
      this.workersService.findByEmail(email, true),
    ]);
    const account = admin ?? worker;
    if (!account) {
      return { message: 'If the account exists, a reset token has been generated', resetToken: null };
    }
    const role = admin ? UserRole.ADMIN : UserRole.WORKER;

    const resetToken = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MS);
    await this.updatePasswordResetToken(account.id, role, resetTokenHash, expiresAt);

    return {
      message: 'Password reset token generated',
      resetToken,
    };
  }

  async resetPassword(resetToken: string, newPassword: string): Promise<MessageResponse> {
    const match = await this.findAccountByResetToken(resetToken);
    if (!match || !match.account.passwordResetTokenHash || !match.account.passwordResetTokenExpiresAt) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const tokenMatches = await bcrypt.compare(resetToken, match.account.passwordResetTokenHash);
    if (!tokenMatches || match.account.passwordResetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.updatePasswordHash(match.account.id, match.role, passwordHash);
    await this.updatePasswordResetToken(match.account.id, match.role, null, null);
    await this.updateRefreshTokenHash(match.account.id, match.role, null);

    return { message: 'Password reset successfully' };
  }

  private findAccountById(id: number, role: UserRole, withSecrets = false): Promise<Account | null> {
    return role === UserRole.ADMIN ? this.adminsService.findById(id, withSecrets) : this.workersService.findById(id, withSecrets);
  }

  private updateRefreshTokenHash(id: number, role: UserRole, refreshTokenHash: string | null): Promise<void> {
    return role === UserRole.ADMIN
      ? this.adminsService.updateRefreshTokenHash(id, refreshTokenHash)
      : this.workersService.updateRefreshTokenHash(id, refreshTokenHash);
  }

  private updatePasswordResetToken(
    id: number,
    role: UserRole,
    passwordResetTokenHash: string | null,
    passwordResetTokenExpiresAt: Date | null,
  ): Promise<void> {
    return role === UserRole.ADMIN
      ? this.adminsService.updatePasswordResetToken(id, passwordResetTokenHash, passwordResetTokenExpiresAt)
      : this.workersService.updatePasswordResetToken(id, passwordResetTokenHash, passwordResetTokenExpiresAt);
  }

  private updatePasswordHash(id: number, role: UserRole, passwordHash: string): Promise<void> {
    return role === UserRole.ADMIN
      ? this.adminsService.updatePasswordHash(id, passwordHash)
      : this.workersService.updatePasswordHash(id, passwordHash);
  }

  private async issueSession(account: Account, role: UserRole): Promise<LoginResponse> {
    const { permissions, staffRole } = await this.resolveStaffContext(account, role);

    const payload: JwtPayload = { sub: account.id, email: account.email, role, permissions };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
    await this.updateRefreshTokenHash(account.id, role, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: this.toAuthUser(account, role, permissions, staffRole),
    };
  }

  private async resolveStaffContext(
    account: Account,
    role: UserRole,
  ): Promise<{ permissions: PermissionPair[]; staffRole: StaffRoleSummary | null }> {
    if (role !== UserRole.ADMIN) {
      return { permissions: [], staffRole: null };
    }

    const roleId = (account as Admin).roleId;
    if (!roleId) {
      return { permissions: [], staffRole: null };
    }

    const roleEntity = await this.rolesService.findById(roleId);
    return {
      permissions: roleEntity.permissions.map((permission) => ({ action: permission.action, subject: permission.subject })),
      staffRole: { id: roleEntity.id, name: roleEntity.name, slug: roleEntity.slug },
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

  private async findAccountByResetToken(resetToken: string): Promise<{ account: Account; role: UserRole } | null> {
    const [admins, workers] = await Promise.all([
      this.adminsService.findAdminsWithResetSecrets(),
      this.workersService.findWorkersWithResetSecrets(),
    ]);

    const candidates: { account: Account; role: UserRole }[] = [
      ...admins.map((account) => ({ account, role: UserRole.ADMIN })),
      ...workers.map((account) => ({ account, role: UserRole.WORKER })),
    ];

    for (const candidate of candidates) {
      const { account } = candidate;
      if (!account.passwordResetTokenHash || !account.passwordResetTokenExpiresAt) {
        continue;
      }

      const tokenMatches = await bcrypt.compare(resetToken, account.passwordResetTokenHash);
      if (tokenMatches && account.passwordResetTokenExpiresAt.getTime() >= Date.now()) {
        return candidate;
      }
    }

    return null;
  }

  private toAuthUser(account: Account, role: UserRole, permissions: PermissionPair[], staffRole: StaffRoleSummary | null): AuthUser {
    return {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      role,
      permissions,
      staffRole,
    };
  }
}
