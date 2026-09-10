// ISO-week date math. All functions normalize to UTC noon so that
// week boundaries are stable regardless of the host timezone.

/** UTC-noon normalization for a date-like value. */
export function toDateOnly(d: Date | string): Date {
	const copy = d instanceof Date ? new Date(d) : new Date(`${d}T00:00:00Z`);
	copy.setUTCHours(12, 0, 0, 0);
	return copy;
}

/** Monday of the ISO week containing `d` (UTC noon normalized). */
export function mondayOf(d: Date | string): Date {
	const day = toDateOnly(d);
	// getUTCDay(): Sun=0 .. Sat=6 → ISO: Mon=1..Sun=7
	const isoDow = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
	day.setUTCDate(day.getUTCDate() - (isoDow - 1));
	return day;
}
