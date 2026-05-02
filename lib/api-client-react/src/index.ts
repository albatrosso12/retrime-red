export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

// Re-export types for convenience
export type { Appeal, Verdict, UserResponse, AuthResponse, SubmitVerdictBody, SubmitVerdictResponse } from "./generated/api.schemas";
