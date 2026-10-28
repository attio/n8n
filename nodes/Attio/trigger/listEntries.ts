import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGet, dataObjectSchema } from '../shared/request';
import type { ListEntryEvent } from './webhooks';

// The record can be deleted after the event, such as when deleting it removes it from the list,
// so it's null like the List Entry Get Many output
async function getParentRecord(
	context: IWebhookFunctions,
	event: ListEntryEvent,
): Promise<IDataObject | null> {
	const { parent_object_id, parent_record_id } = event;
	try {
		return await attioGet(
			context,
			`/objects/${encodeURIComponent(parent_object_id)}/records/${encodeURIComponent(parent_record_id)}`,
			dataObjectSchema,
			'record',
		);
	} catch (error) {
		if (error instanceof NodeApiError && error.httpCode === '404') return null;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

export async function getListEntry(
	context: IWebhookFunctions,
	event: ListEntryEvent,
	includeParentRecord: boolean,
): Promise<IDataObject> {
	const { list_id, entry_id } = event.id;
	const [entry, parentRecord] = await Promise.all([
		attioGet(
			context,
			`/lists/${encodeURIComponent(list_id)}/entries/${encodeURIComponent(entry_id)}`,
			dataObjectSchema,
			'list entry',
		),
		includeParentRecord ? getParentRecord(context, event) : undefined,
	]);

	return includeParentRecord ? { ...entry, parent_record: parentRecord } : entry;
}

// The entry no longer exists, so the event is output with its IDs
export async function getDeletedListEntry(
	context: IWebhookFunctions,
	event: ListEntryEvent,
	includeParentRecord: boolean,
): Promise<IDataObject> {
	if (!includeParentRecord) return event;
	return { ...event, parent_record: await getParentRecord(context, event) };
}
