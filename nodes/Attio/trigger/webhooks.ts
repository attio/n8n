import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeApiError,
	type IHookFunctions,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGetList, attioRequest, isObject } from '../shared/request';

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

type WebhookResponse = {
	id: { webhook_id: string };
	target_url: string;
	status: 'active' | 'degraded' | 'inactive';
};

type CreatedWebhookResponse = WebhookResponse & { secret: string };

export type RecordEvent = {
	event_type: string;
	id: {
		workspace_id: string;
		object_id: string;
		record_id: string;
		attribute_id?: string;
	};
	actor: { type: string | null; id: string | null };
};

export type ListEntryEvent = {
	event_type: string;
	id: {
		workspace_id: string;
		list_id: string;
		entry_id: string;
		attribute_id?: string;
	};
	parent_object_id: string;
	parent_record_id: string;
	actor: { type: string | null; id: string | null };
};

export type TaskEvent = {
	event_type: string;
	id: { workspace_id: string; task_id: string };
	actor: { type: string | null; id: string | null };
};

export type CallRecordingEvent = {
	event_type: string;
	id: { workspace_id: string; meeting_id: string; call_recording_id: string };
	actor: { type: string | null; id: string | null };
};

export type ActivityRecordEvent = {
	event_type: string;
	id: { workspace_id: string; activity_id: string; record_id: string };
	actor: { type: string | null; id: string | null };
};

function isWebhookResponse(value: unknown): value is WebhookResponse {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.webhook_id === 'string' &&
		typeof value.target_url === 'string' &&
		(value.status === 'active' || value.status === 'degraded' || value.status === 'inactive')
	);
}

function isCreatedWebhookResponse(value: unknown): value is CreatedWebhookResponse {
	return isObject(value) && typeof value.secret === 'string' && isWebhookResponse(value);
}

function isRecordEvent(value: unknown): value is RecordEvent {
	return (
		isObject(value) &&
		typeof value.event_type === 'string' &&
		isObject(value.id) &&
		typeof value.id.object_id === 'string' &&
		typeof value.id.record_id === 'string' &&
		isObject(value.actor)
	);
}

function isListEntryEvent(value: unknown): value is ListEntryEvent {
	return (
		isObject(value) &&
		typeof value.event_type === 'string' &&
		isObject(value.id) &&
		typeof value.id.list_id === 'string' &&
		typeof value.id.entry_id === 'string' &&
		typeof value.parent_object_id === 'string' &&
		typeof value.parent_record_id === 'string' &&
		isObject(value.actor)
	);
}

function isTaskEvent(value: unknown): value is TaskEvent {
	return (
		isObject(value) &&
		typeof value.event_type === 'string' &&
		isObject(value.id) &&
		typeof value.id.task_id === 'string' &&
		isObject(value.actor)
	);
}

function isCallRecordingEvent(value: unknown): value is CallRecordingEvent {
	return (
		isObject(value) &&
		typeof value.event_type === 'string' &&
		isObject(value.id) &&
		typeof value.id.meeting_id === 'string' &&
		typeof value.id.call_recording_id === 'string' &&
		isObject(value.actor)
	);
}

function isActivityRecordEvent(value: unknown): value is ActivityRecordEvent {
	return (
		isObject(value) &&
		typeof value.event_type === 'string' &&
		isObject(value.id) &&
		typeof value.id.activity_id === 'string' &&
		typeof value.id.record_id === 'string' &&
		isObject(value.actor)
	);
}

// Webhook deletes return an empty body
function isEmptyResponse(data: unknown): data is undefined {
	return data === undefined || isObject(data);
}

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
			isWebhookResponse,
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
			isEmptyResponse,
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
			isWebhookResponse,
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
		isCreatedWebhookResponse,
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
function getEvents<T>(context: IWebhookFunctions, isEvent: (value: unknown) => value is T): T[] {
	const { events } = context.getBodyData();
	return Array.isArray(events) ? events.filter(isEvent) : [];
}

export function getRecordEvents(context: IWebhookFunctions): RecordEvent[] {
	return getEvents(context, isRecordEvent);
}

export function getListEntryEvents(context: IWebhookFunctions): ListEntryEvent[] {
	return getEvents(context, isListEntryEvent);
}

export function getTaskEvents(context: IWebhookFunctions): TaskEvent[] {
	return getEvents(context, isTaskEvent);
}

export function getCallRecordingEvents(context: IWebhookFunctions): CallRecordingEvent[] {
	return getEvents(context, isCallRecordingEvent);
}

export function getActivityRecordEvents(context: IWebhookFunctions): ActivityRecordEvent[] {
	return getEvents(context, isActivityRecordEvent);
}
