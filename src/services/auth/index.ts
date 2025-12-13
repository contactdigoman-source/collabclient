// Export login service (AccountStatus exported here)
export * from './login-service';

// Export OTP service (re-export AccountStatus from login-service to avoid conflict)
export {
  type VerifyOTPRequest,
  type VerifyOTPResponse,
  type ResendOTPRequest,
  type ResendOTPResponse,
  verifyOTP,
  resendOTP,
} from './otp-service';
// Re-export AccountStatus from login-service (same type, avoid duplicate)
export type { AccountStatus } from './login-service';

// Export forgot password service
export * from './forgot-password-service';

// Export first-time login service
export * from './first-time-login-service';

// Export session service
export * from './session-service';

// Export profile service
export {
  type ProfileResponse,
  type UpdateProfileRequest,
  type UpdateProfileResponse,
  type UploadProfilePhotoResponse,
  type ChangePasswordRequest,
  type ChangePasswordResponse,
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  changePassword,
} from './profile-service';

