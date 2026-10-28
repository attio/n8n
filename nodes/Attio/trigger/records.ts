import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioGet, attioGetList, dataObjectSchema } from '../shared/request';
import type { RecordEvent } from './webhooks';

const listEntryReferenceSchema = z.object({
	list_id: z.string(),
	list_api_slug: z.string(),
	entry_id: z.string(),
	created_at: z.string(),
});

type ListEntryReference = z.infer<typeof listEntryReferenceSchema>;

function recordPath(event: RecordEvent): string {
	const { object_id, record_id } = event.id;
	return `/objects/${encodeURIComponent(object_id)}/records/${encodeURIComponent(record_id)}`;
}

// The record's entries across every list, without their values
async function getListEntries(
	context: IWebhookFunctions,
	event: RecordEvent,
): Promise<ListEntryReference[]> {
	const pageSize = 1000;
	const entries: ListEntryReference[] = [];

	try {
		for (let offset = 0; ; offset += pageSize) {
			const page = await attioGetList(
				context,
				`${recordPath(event)}/entries?limit=${pageSize}&offset=${offset}`,
				listEntryReferenceSchema,
			);
			entries.push(...page);
			if (page.length < pageSize) return entries;
		}
	} catch (error) {
		// A token without list access can still trigger on records, so it gets no entries
		if (error instanceof NodeApiError && error.httpCode === '403') return [];
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

export async function getRecord(
	context: IWebhookFunctions,
	event: RecordEvent,
	includeListEntries: boolean,
): Promise<IDataObject> {
	const [record, listEntries] = await Promise.all([
		attioGet(context, recordPath(event), dataObjectSchema, 'record'),
		includeListEntries ? getListEntries(context, event) : undefined,
	]);

	return listEntries === undefined ? record : { ...record, list_entries: listEntries };
}
