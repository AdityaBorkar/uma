import { sql } from "drizzle-orm";

import { db } from "#/lib/db.ts";
import { projects } from "#/schemas/db/projects.ts";

async function main() {
	const { user } = await import("#/schemas/db/auth.gen.ts");

	// Owner: first existing user or a local QA placeholder.
	const [existingUser] = await db.select().from(user).limit(1);
	let userId: string;
	if (existingUser) {
		userId = existingUser.id;
	} else {
		userId = "seed-user-1";
		await db
			.insert(user)
			.values({
				createdAt: new Date(),
				email: "demo@example.com",
				emailVerified: true,
				id: userId,
				name: "Demo User",
				updatedAt: new Date(),
			})
			.onConflictDoNothing();
	}

	const projectId = crypto.randomUUID();
	await db.insert(projects).values({
		createdBy: userId,
		definitionOfDone:
			"Beta checklist signed off by PO, payments e2e tested, SSO via Google works in staging",
		description:
			"Q3 flagship — outcome → scope → sequence → constraints → feedback → decisions → completion",
		id: projectId,
		name: "Acme Portal — Beta",
		outcome: "Acme portal ships to beta users covering payments + SSO",
		slug: "acme-portal-beta",
		status: "active",
	});

	// Demo documents: wiki, spec, bug report, and a weekly update — all rows
	// in the single `documents` table, distinguished only by kind
	// (docs/adr/004-documents-single-primitive.md + docs/CONTEXT.md).
	const { documentCounters, documentEvents, documents } = await import(
		"#/schemas/db/documents.ts"
	);

	const demoDocs: Array<{
		body: string;
		kind: "bug_report" | "spec" | "update" | "wiki";
		labels: string[];
		title: string;
	}> = [
		{
			body: `---
title: Team handbook
kind: wiki
labels:
  - handbook
---

# Team handbook

## Cadence

Plan in weeks: scope what ships this week, review what shipped, then start the
next.

## Definitions

See the glossary in \`docs/CONTEXT.md\`.
`,
			kind: "wiki",
			labels: ["handbook"],
			title: "Team handbook",
		},
		{
			body: `---
title: Payments API specification
kind: spec
labels:
  - api
  - payments
meta:
  status: review
---

# Payments API

## Scope

Charge, refund, and webhook endpoints.

## Non-goals

Invoicing.
`,
			kind: "spec",
			labels: ["api", "payments"],
			title: "Payments API specification",
		},
		{
			body: `---
title: SSO redirect loops on staging
kind: bug_report
labels:
  - bug
meta:
  severity: critical
---

# SSO redirect loop

Google OAuth completes, then the callback bounces back to the login page.

## Steps

1. Sign in with Google on staging
2. Observe the redirect loop
`,
			kind: "bug_report",
			labels: ["bug"],
			title: "SSO redirect loops on staging",
		},
		{
			body: `---
title: Weekly update — auth flows shipped
kind: update
labels: []
---

Auth flows and project CRUD shipped to staging this week. Next up: payments
integration (#2).
`,
			kind: "update",
			labels: [],
			title: "Weekly update — auth flows shipped",
		},
	];

	let docNumber = 0;
	for (const doc of demoDocs) {
		const [counter] = await db
			.insert(documentCounters)
			.values({ nextNumber: 1, userId })
			.onConflictDoUpdate({
				set: { nextNumber: sql`${documentCounters.nextNumber} + 1` },
				target: documentCounters.userId,
			})
			.returning();
		if (!counter) {
			throw new Error("counter allocation failed");
		}
		docNumber = counter.nextNumber;
		const slug = doc.title
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replaceAll(/^-+|-+$/g, "");
		const id = crypto.randomUUID();
		await db.insert(documents).values({
			body: doc.body,
			createdBy: userId,
			id,
			kind: doc.kind,
			labels: doc.labels,
			number: docNumber,
			slug,
			title: doc.title,
		});
		await db.insert(documentEvents).values({
			actorId: userId,
			documentId: id,
			id: crypto.randomUUID(),
			kind: "opened",
			payload: {},
		});
	}
	process.exit(0);
}

main().catch((_error) => {
	process.exit(1);
});
