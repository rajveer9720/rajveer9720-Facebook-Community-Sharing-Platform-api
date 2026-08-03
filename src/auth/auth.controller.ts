import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ForgotPasswordDto, LoginDto, RefreshTokenDto, RegisterDto, ResetPasswordDto } from '../dto/auth.dto';
import { AuthService } from './auth.service';
import { LoginResponse, ForgotPasswordResponse, MessageResponse } from '../interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: RefreshTokenDto): Promise<MessageResponse> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
