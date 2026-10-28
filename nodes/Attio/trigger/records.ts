import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGet, attioGetList, isObject } from '../shared/request';
import type { RecordEvent } from './webhooks';

type ListEntryReference = {
	list_id: string;
	list_api_slug: string;
	entry_id: string;
	created_at: string;
};

function isListEntryReference(value: unknown): value is ListEntryReference {
	return (
		isObject(value) &&
		typeof value.list_id === 'string' &&
		typeof value.list_api_slug === 'string' &&
		typeof value.entry_id === 'string' &&
		typeof value.created_at === 'string'
	);
}

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
				isListEntryReference,
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
		attioGet(context, recordPath(event), (data): data is IDataObject => isObject(data), 'record'),
		includeListEntries ? getListEntries(context, event) : undefined,
	]);

	return listEntries === undefined ? record : { ...record, list_entries: listEntries };
}
