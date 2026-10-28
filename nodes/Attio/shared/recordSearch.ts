import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioRequest } from './request';

const recordSearchResultSchema = z.object({
	id: z.object({ record_id: z.string() }),
	record_text: z.string(),
});

// Searches an object's records, matching names, domains, email addresses and the like. Attio's
// search endpoint returns at most 25 results and has no paging
export async function searchObjectRecords(
	context: ILoadOptionsFunctions,
	object: string,
	filter?: string,
): Promise<INodeListSearchResult> {
	const records = await attioRequest(
		context,
		{
			method: 'POST',
			path: '/objects/records/search',
			body: {
				// An empty query returns Attio's default set of results
				query: filter ?? '',
				objects: [object],
				limit: 25,
				request_as: { type: 'workspace' },
			},
		},
		z.array(recordSearchResultSchema),
		'list',
	);

	return {
		results: records.map((record) => ({
			name: record.record_text || record.id.record_id,
			value: record.id.record_id,
		})),
	};
}
