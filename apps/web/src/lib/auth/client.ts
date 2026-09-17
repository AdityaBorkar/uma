import { multiSessionClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { publicServerUrl } from "#/env.ts";

/** Session client against the control plane (`/api/auth/*` on `apps/server`). */
export const authClient = createAuthClient({
	baseURL: `${publicServerUrl}/api/auth`,
	plugins: [multiSessionClient()],
});
