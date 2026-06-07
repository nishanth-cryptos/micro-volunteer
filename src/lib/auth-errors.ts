// Map Firebase Auth error codes to short, user-facing messages.
// Reference: https://firebase.google.com/docs/auth/admin/errors
// (Codes intentionally narrowed to ones we surface in M1 forms.)

export function readableAuthError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Something went wrong. Try again.';
  const code = (err as { code?: string }).code;
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number does not look right. Include the country code, e.g. +91 99999 99999.';
    case 'auth/missing-phone-number':
      return 'Please enter a phone number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
    case 'auth/code-expired':
      return 'That code is wrong or expired. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'That email does not look right.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email or password is incorrect.';
    case 'auth/network-request-failed':
      return 'Network problem — check your connection and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}
