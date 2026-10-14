import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	ResourceMapperFields,
} from 'n8n-workflow';
import { isListResponse } from '../../shared/lists';
import { attioGet, attioRequest, isObject } from '../../shared/request';
import { getAttributeFields } from '../record/attributes';

type RecordSearchResult = {
	id: { record_id: string };
	record_text: string;
};

function isRecordSearchResult(value: unknown): value is RecordSearchResult {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.record_id === 'string' &&
		typeof value.record_text === 'string'
	);
}

export async function getListEntryAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const list = this.getNodeParameter('list', '') as string;
	if (!list) {
		return { fields: [], emptyFieldsNotice: 'Choose a list to see its attributes' };
	}

	const result = await getAttributeFields.call(
		this,
		`/lists/${encodeURIComponent(list)}/attributes`,
	);

	// A load error already comes with its own notice
	if (result.fields.length === 0 && !result.emptyFieldsNotice) {
		result.emptyFieldsNotice =
			'This list has no attributes that can be set, so records are added to it without entry values. Add attributes to the list in Attio, then refresh, to set them here.';
	}

	return result;
}

// Searches the records that can be added to the chosen list, matching names, domains, email
// addresses and the like. Attio's search endpoint returns at most 25 results and has no paging
export async function searchListParentRecords(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const list = this.getCurrentNodeParameter('list') as string | undefined;
	if (!list) return { results: [] };

	const { parent_object: objects } = await attioGet(
		this,
		`/lists/${encodeURIComponent(list)}`,
		isListResponse,
		'list',
	);
	if (objects.length === 0) return { results: [] };

	const records = await attioRequest(
		this,
		{
			method: 'POST',
			path: '/objects/records/search',
			body: {
				// An empty query returns Attio's default set of results
				query: filter ?? '',
				objects,
				limit: 25,
				request_as: { type: 'workspace' },
			},
		},
		(data): data is RecordSearchResult[] => Array.isArray(data) && data.every(isRecordSearchResult),
		'list',
	);

	return {
		results: records.map((record) => ({
			name: record.record_text || record.id.record_id,
			value: record.id.record_id,
		})),
	};
}
