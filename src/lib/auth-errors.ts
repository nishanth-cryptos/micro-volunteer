// Map Firebase Auth error codes to helpful, user-facing explanations and recovery paths.
// Reference: https://firebase.google.com/docs/auth/admin/errors

export function readableAuthError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'Something went wrong. Please check your details and try again.';
  }
  const code = (err as { code?: string }).code;
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Please enter a valid phone number including country code (e.g. +91 98765 43210).';
    case 'auth/missing-phone-number':
      return 'Please enter your phone number to continue.';
    case 'auth/quota-exceeded':
    case 'auth/too-many-requests':
      return 'Too many attempts. For security, please wait a few minutes before trying again.';
    case 'auth/invalid-verification-code':
      return 'The 6-digit code entered is incorrect. Please check the code and try again.';
    case 'auth/code-expired':
      return 'The verification code has expired. Please request a new code.';
    case 'auth/session-expired':
      return 'Your verification session expired. Please enter your phone number again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address (e.g. name@example.com).';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters with a mix of letters and numbers.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password. Please verify your login credentials.';
    case 'auth/user-disabled':
      return 'This account has been deactivated. Please contact community support.';
    case 'auth/network-request-failed':
      return 'Network connection problem. Please check your internet connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Verification popup was closed before completion. Please try again.';
    case 'auth/captcha-check-failed':
      return 'Security verification could not be completed. Please refresh and try again.';
    default:
      if (
        err instanceof Error &&
        err.message &&
        !err.message.startsWith('Firebase:')
      ) {
        return err.message;
      }
      return 'We could not complete your request. Please try again or switch sign-in methods.';
  }
}
