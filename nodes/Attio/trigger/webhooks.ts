import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeApiError,
	type IHookFunctions,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioGetList, attioRequest, dataObjectSchema, matches } from '../shared/request';

export type RecordEventType = 'record.created' | 'record.updated' | 'record.deleted';

export type ListEntryEventType = 'list-entry.created' | 'list-entry.updated' | 'list-entry.deleted';

export type EventType =
	| RecordEventType
	| ListEntryEventType
	| 'task.created'
	| 'call-recording.created'
	| 'activity-record.created';

export type WebhookFilter = {
	$and: Array<{ field: string; operator: 'equals'; value: string }>;
};

const webhookSchema = z.object({
	id: z.object({ webhook_id: z.string() }),
	target_url: z.string(),
	status: z.enum(['active', 'degraded', 'inactive']),
});

type WebhookResponse = z.infer<typeof webhookSchema>;

const createdWebhookSchema = webhookSchema.extend({ secret: z.string() });

type CreatedWebhookResponse = z.infer<typeof createdWebhookSchema>;

const recordEventSchema = z.object({
	event_type: z.string(),
	id: z.object({
		object_id: z.string(),
		record_id: z.string(),
		attribute_id: z.string().optional(),
	}),
	actor: dataObjectSchema,
});

export type RecordEvent = z.infer<typeof recordEventSchema>;

const listEntryEventSchema = z.object({
	event_type: z.string(),
	id: z.object({
		list_id: z.string(),
		entry_id: z.string(),
		attribute_id: z.string().optional(),
	}),
	parent_object_id: z.string(),
	parent_record_id: z.string(),
	actor: dataObjectSchema,
});

export type ListEntryEvent = z.infer<typeof listEntryEventSchema>;

const taskEventSchema = z.object({
	event_type: z.string(),
	id: z.object({ task_id: z.string() }),
	actor: dataObjectSchema,
});

export type TaskEvent = z.infer<typeof taskEventSchema>;

const callRecordingEventSchema = z.object({
	event_type: z.string(),
	id: z.object({ meeting_id: z.string(), call_recording_id: z.string() }),
	actor: dataObjectSchema,
});

export type CallRecordingEvent = z.infer<typeof callRecordingEventSchema>;

const activityRecordEventSchema = z.object({
	event_type: z.string(),
	id: z.object({ activity_id: z.string(), record_id: z.string() }),
	actor: dataObjectSchema,
});

export type ActivityRecordEvent = z.infer<typeof activityRecordEventSchema>;

// Webhook deletes return an empty body
const emptyResponseSchema = z.union([z.undefined(), dataObjectSchema]);

function isNotFound(error: unknown): boolean {
	return error instanceof NodeApiError && error.httpCode === '404';
}

export async function getWebhook(
	context: IHookFunctions,
	webhookId: string,
): Promise<WebhookResponse | undefined> {
	try {
		return await attioRequest(
			context,
			{ method: 'GET', path: `/webhooks/${encodeURIComponent(webhookId)}` },
			webhookSchema,
			'webhook',
		);
	} catch (error) {
		if (isNotFound(error)) return undefined;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

export async function deleteWebhook(context: IHookFunctions, webhookId: string): Promise<void> {
	try {
		await attioRequest(
			context,
			{ method: 'DELETE', path: `/webhooks/${encodeURIComponent(webhookId)}` },
			emptyResponseSchema,
			'empty response',
		);
	} catch (error) {
		// Already deleted, such as from Attio's developer settings
		if (isNotFound(error)) return;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

// Attio rejects a second subscription with the same URL, event and filter. Webhook URLs are
// unique to this node, so any webhook already targeting it was left behind by an earlier activation
async function deleteWebhooksTargeting(context: IHookFunctions, targetUrl: string): Promise<void> {
	const pageSize = 100;
	const stale: string[] = [];

	for (let offset = 0; ; offset += pageSize) {
		const page = await attioGetList(
			context,
			`/webhooks?limit=${pageSize}&offset=${offset}`,
			webhookSchema,
		);
		for (const webhook of page) {
			if (webhook.target_url === targetUrl) stale.push(webhook.id.webhook_id);
		}
		if (page.length < pageSize) break;
	}

	for (const webhookId of stale) {
		await deleteWebhook(context, webhookId);
	}
}

export async function createWebhook(
	context: IHookFunctions,
	targetUrl: string,
	eventType: EventType,
	filter: WebhookFilter | null,
): Promise<CreatedWebhookResponse> {
	await deleteWebhooksTargeting(context, targetUrl);

	return await attioRequest(
		context,
		{
			method: 'POST',
			path: '/webhooks',
			body: {
				data: {
					target_url: targetUrl,
					subscriptions: [{ event_type: eventType, filter }],
				},
			},
		},
		createdWebhookSchema,
		'webhook',
	);
}

// Attio signs the raw body with an SHA256 HMAC of the webhook's secret, hex encoded
export function hasValidSignature(context: IWebhookFunctions, secret: string): boolean {
	const signature = context.getHeaderData()['attio-signature'];
	const { rawBody } = context.getRequestObject() as { rawBody?: unknown };
	if (typeof signature !== 'string' || !Buffer.isBuffer(rawBody)) return false;

	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
	const received = Buffer.from(signature, 'utf8');
	const computed = Buffer.from(expected, 'utf8');

	return received.length === computed.length && timingSafeEqual(received, computed);
}

// Attio batches events, so a delivery can hold several
function getEvents<T>(context: IWebhookFunctions, schema: z.ZodType<T>): T[] {
	const { events } = context.getBodyData();
	return Array.isArray(events) ? events.filter((event): event is T => matches(schema, event)) : [];
}

export function getRecordEvents(context: IWebhookFunctions): RecordEvent[] {
	return getEvents(context, recordEventSchema);
}

export function getListEntryEvents(context: IWebhookFunctions): ListEntryEvent[] {
	return getEvents(context, listEntryEventSchema);
}

export function getTaskEvents(context: IWebhookFunctions): TaskEvent[] {
	return getEvents(context, taskEventSchema);
}

export function getCallRecordingEvents(context: IWebhookFunctions): CallRecordingEvent[] {
	return getEvents(context, callRecordingEventSchema);
}

export function getActivityRecordEvents(context: IWebhookFunctions): ActivityRecordEvent[] {
	return getEvents(context, activityRecordEventSchema);
}
