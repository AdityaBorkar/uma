import { toast } from "./toast.ts";

/** Shared clipboard helper. Toasts success/failure through the toast store. */
export function copyText(text: string, title: string) {
	const done = () => toast({ title });
	const fail = () => toast({ title: "Copy failed", variant: "destructive" });
	try {
		const result = navigator.clipboard?.writeText(text);
		if (result && typeof result.then === "function") {
			void result.then(done, fail);
			return;
		}
		done();
	} catch {
		fail();
	}
}
