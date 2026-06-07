// Cloud Functions entry point.
// Governs: memory-bank/systemPatterns.md (server-authoritative model).
// Each function lives in its own file and is re-exported here so the
// emulator + deploy pipeline can find them by export name.

export { rankNearbyVolunteers } from './rank-nearby-volunteers';
export { dispatchOffers } from './dispatch-offers';
export { acceptOffer } from './accept-offer';
export { rejectOffer } from './reject-offer';
export { generateStartOtp } from './generate-start-otp';
export { verifyStartOtp } from './verify-start-otp';
export { generateEndOtp } from './generate-end-otp';
export { verifyEndOtp } from './verify-end-otp';
export { submitCustomerRating } from './submit-customer-rating';
