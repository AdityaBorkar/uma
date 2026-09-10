import { z } from "zod";

// WS channel I/O (unary wrappers; streaming uses `eventIterator`).

/** Ack for a machine→server frame delivered over the WS channel. */
export const WsSendAckSchema = z.object({ ok: z.literal(true) });
export type WsSendAck = z.infer<typeof WsSendAckSchema>;

/** Subscribe input for the server→machine stream (resumption via lastEventId). */
export const WsSubscribeInputSchema = z.object({
	lastEventId: z.string().optional(),
	machineId: z.string().min(1),
});
export type WsSubscribeInput = z.infer<typeof WsSubscribeInputSchema>;
