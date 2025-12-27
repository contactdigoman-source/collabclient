// Export login service (AccountStatus exported here)
export * from './login-service';

// Export OTP service (re-export AccountStatus from login-service to avoid conflict)
export {
  type VerifyOTPRequest,
  type VerifyOTPResponse,
  type LegacyVerifyOTPRequest,
  type LegacyVerifyOTPResponse,
  type ResendOTPRequest,
  type ResendOTPResponse,
  verifyLoginOTP,
  verifyOTP,
  resendOTP,
} from './otp-service';
// Re-export AccountStatus from login-service (same type, avoid duplicate)
export type { AccountStatus } from './login-service';

// Export forgot password service
export {
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  forgotPassword,
  resetPassword,
} from './forgot-password-service';

// Export first-time login service
export * from './first-time-login-service';

// Export session service
export * from './session-service';

// Export profile service
export {
  type ProfileResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  getProfile,
  updateProfile,
  changePassword,
} from './profile-service';

