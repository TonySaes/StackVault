// Public source status contract
// The backend currently exposes source statuses as strings. This alias keeps
// the API shape honest while giving resource and coverage contracts one shared
// name to tighten later if the backend moves to an enum.
export type PublicSourceStatus = string;
