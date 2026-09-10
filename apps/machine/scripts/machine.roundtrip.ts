// heartbeat -> claim -> log -> done vs the web server (E2E_SEED=1).
// Usage: bun run scripts/machine.roundtrip.ts --server http://127.0.0.1:3000
// The web server must run with E2E_SEED=1 so the /api/test/* seed helpers
// (approve, queue-task, task, heartbeats) are enabled. Production refuses
// them with 404.
import cac from "cac";

const roundtripCli = cac("machine.roundtrip");
roundtripCli.option("--server <url>", "Server URL");
roundtripCli.parse(process.argv, { run: false });
const rawServer = roundtripCli.options.server as string | number | undefined;

const SERVER = String(
	typeof rawServer === "string" || typeof rawServer === "number"
		? rawServer
		: (process.env.UMA_SERVER_URL ?? "http://127.0.0.1:3000"),
).replace(/\/$/, "");
const WS_URL =
	SERVER.replace("https://", "wss://").replace("http://", "ws://") +
	"/api/machines/ws";

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(`roundtrip FAIL: ${msg}`);
}

console.log(`[roundtrip] server=${SERVER}`);

// 1. device.code
const codeRes = await fetch(`${SERVER}/device/code`, {
	body: JSON.stringify({
		client_id: "roundtrip",
		machineName: `rt-${Date.now().toString(36)}`,
	}),
	headers: { "content-type": "application/json" },
	method: "POST",
});
assert(codeRes.ok, `device.code HTTP ${codeRes.status}`);
const code = (await codeRes.json()) as {
	device_code: string;
	user_code: string;
	verification_uri_complete: string;
	interval: number;
};
console.log(`[roundtrip] code=${code.user_code}`);

// 2. approve via dev seed endpoint (stands in for the browser approval UI at
// /device; 404 unless the server runs with E2E_SEED=1).
const approveRes = await fetch(`${SERVER}/api/test/approve`, {
	body: JSON.stringify({ approve: true, user_code: code.user_code }),
	headers: { "content-type": "application/json" },
	method: "POST",
});
assert(
	approveRes.ok,
	`approve HTTP ${approveRes.status} (is E2E_SEED=1 set on the server?)`,
);
console.log(`[roundtrip] approved`);

// 3. device.token
const tokRes = await fetch(`${SERVER}/device/token`, {
	body: JSON.stringify({
		client_id: "roundtrip",
		device_code: code.device_code,
		grant_type: "urn:ietf:params:oauth:grant-type:device_code",
	}),
	headers: { "content-type": "application/json" },
	method: "POST",
});
const tokText = await tokRes.text();
assert(
	tokRes.ok,
	`device.token HTTP ${tokRes.status}: ${tokText.slice(0, 300)}`,
);
const tok = JSON.parse(tokText) as { access_token: string; machine_id: string };
console.log(`[roundtrip] token machine=${tok.machine_id}`);
const auth = {
	authorization: `Bearer ${tok.access_token}`,
	"content-type": "application/json",
};

// 4. ws connect (Bearer session auth)
const ws = new WebSocket(WS_URL, {
	headers: { authorization: `Bearer ${tok.access_token}` },
} as never);
await new Promise<void>((resolve, reject) => {
	const t = setTimeout(() => reject(new Error("ws open timeout")), 8000);
	ws.addEventListener("open", () => {
		clearTimeout(t);
		resolve();
	});
	ws.addEventListener("error", (e) => {
		clearTimeout(t);
		reject(new Error(`ws error ${String(e).slice(0, 200)}`));
	});
});
console.log(`[roundtrip] ws open`);

const send = (f: Record<string, unknown>) => ws.send(JSON.stringify(f));
const received: unknown[] = [];
ws.addEventListener("message", (ev) => {
	try {
		received.push(JSON.parse(String(ev.data)));
	} catch {
		// ignore
	}
});

// 5. heartbeat
send({
	cliVersion: "0.1.0",
	configVersion: "v1",
	machineId: tok.machine_id,
	metrics: { cpu: 5, disk: 30, pids: [1], ram: 20 },
	protocol: "v1",
	quotaUsage: { running: 0, total: 0 },
	sandboxes: [],
	scopeHint: null,
	t: "heartbeat",
});
await new Promise((r) => setTimeout(r, 800));
const hb = (await fetch(
	`${SERVER}/api/test/heartbeats?machineId=${tok.machine_id}`,
	{ headers: auth },
).then((r) => r.json())) as {
	heartbeats: unknown[];
};
assert(hb.heartbeats.length >= 1, "heartbeat not recorded server-side");
console.log(`[roundtrip] heartbeat ack (${hb.heartbeats.length} rows)`);

// 6. queue task + claim (atomic queued -> running, guarded server-side)
const q = (await fetch(`${SERVER}/api/test/queue-task`, {
	body: JSON.stringify({ prompt: "roundtrip hello" }),
	headers: auth,
	method: "POST",
}).then((r) => r.json())) as { task: { id: string } };
const taskId = q.task.id;
console.log(`[roundtrip] queued ${taskId}`);

const claim = await fetch(`${SERVER}/api/machines/claim`, {
	body: JSON.stringify({
		machineId: tok.machine_id,
		sandboxId: "sbx-roundtrip",
		taskId,
	}),
	headers: auth,
	method: "POST",
});
assert(claim.ok, `claim HTTP ${claim.status}`);
console.log(`[roundtrip] claim queued->running`);

// double-claim must 409 (authoritative)
const claim2 = await fetch(`${SERVER}/api/machines/claim`, {
	body: JSON.stringify({
		machineId: tok.machine_id,
		sandboxId: "sbx-other",
		taskId,
	}),
	headers: auth,
	method: "POST",
});
assert(claim2.status === 409, `double claim should 409, got ${claim2.status}`);
console.log(`[roundtrip] double-claim correctly 409`);

// 7. logs visible server-side (stdout/stderr separate)
send({
	chunk: "hello stdout",
	machineId: tok.machine_id,
	protocol: "v1",
	stream: "stdout",
	t: "log",
	taskId,
});
send({
	chunk: "hello stderr",
	machineId: tok.machine_id,
	protocol: "v1",
	stream: "stderr",
	t: "log",
	taskId,
});
await new Promise((r) => setTimeout(r, 800));

// 8. task-done terminal + finishedAt
send({
	machineId: tok.machine_id,
	projectId: null,
	protocol: "v1",
	status: "completed",
	t: "task-done",
	taskId,
});
await new Promise((r) => setTimeout(r, 800));
const done = (await fetch(`${SERVER}/api/test/task?id=${taskId}`, {
	headers: auth,
}).then((r) => r.json())) as {
	task: {
		status: string;
		finishedAt?: string | null;
		logs: { stream: string }[];
	} | null;
};
assert(done.task?.status === "completed", `task status ${done.task?.status}`);
assert(done.task?.finishedAt, "finishedAt missing");
assert(
	done.task?.logs.some((l) => l.stream === "stdout"),
	"stdout log missing",
);
assert(
	done.task?.logs.some((l) => l.stream === "stderr"),
	"stderr log missing",
);
console.log(`[roundtrip] task completed + finishedAt + logs ok`);

// 9. unknown frames ignored (server must not crash — health still ok)
send({ machineId: tok.machine_id, t: "bogus-frame" } as unknown as Record<
	string,
	unknown
>);
await new Promise((r) => setTimeout(r, 300));
const health = (await fetch(`${SERVER}/health`).then((r) => r.json())) as {
	ok: boolean;
};
assert(health.ok === true, "server unhealthy after unknown frame");
console.log(`[roundtrip] unknown-frame ignored, server healthy`);

ws.close();
console.log(`[roundtrip] PASS`);
