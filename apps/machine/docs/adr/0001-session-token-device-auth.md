# Bearer session-token device auth

Enroll uses Better Auth device flow ending in a full user session token (`/device/token`), sent as a Bearer credential; the server pre-binds codes when possible, allowlists clients, and revocation is session revocation. We chose this over scoped OAuth JWTs to keep server setup to one plugin, accepting full-session blast radius contained by 0600 storage, redaction, and one-click revoke.
