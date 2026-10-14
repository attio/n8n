import type {
	IDataObject,
	IExecuteSingleFunctions,
	INodeExecutionData,
} from 'n8n-workflow';
import { attioRequest, isObject } from '../../shared/request';

type RecordResponse = IDataObject & {
	id: { record_id: string };
};

function isRecordResponse(value: unknown): value is RecordResponse {
	return isObject(value) && isObject(value.id) && typeof value.id.record_id === 'string';
}

// Entries only have their parent record's ID, so the record is added as parent_record. Records
// are fetched with one query per object rather than one request per entry. A page has at most 500
// entries, which is also the most a query returns
export async function addParentRecords(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	if (!this.getNodeParameter('includeParentRecord', true)) return items;

	// Legacy lists can have entries from more than one object
	const idsByObject = new Map<string, Set<string>>();
	for (const { json } of items) {
		const { parent_object: object, parent_record_id: recordId } = json;
		if (typeof object !== 'string' || typeof recordId !== 'string') continue;

		idsByObject.set(object, (idsByObject.get(object) ?? new Set()).add(recordId));
	}

	const records = new Map<string, RecordResponse>();
	await Promise.all(
		[...idsByObject].map(async ([object, ids]) => {
			const found = await attioRequest(
				this,
				{
					method: 'POST',
					path: `/objects/${encodeURIComponent(object)}/records/query`,
					body: { filter: { record_id: { $in: [...ids] } }, limit: ids.size },
				},
				(data): data is RecordResponse[] => Array.isArray(data) && data.every(isRecordResponse),
				'list',
			);
			for (const record of found) records.set(record.id.record_id, record);
		}),
	);

	// A record the token can't read is left out of the query results, so it's null
	return items.map((item) => ({
		...item,
		json: {
			...item.json,
			parent_record: records.get(item.json.parent_record_id as string) ?? null,
		},
	}));
}
