import type { IExecuteSingleFunctions, INodeExecutionData } from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioRequest } from '../../shared/request';

const recordSchema = z.object({
	id: z.object({ record_id: z.string() }),
});

// Adds each entry's parent record to it as parent_record, as entries only include the record's ID.
// The records are fetched with one query per object, rather than one request per entry
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

	const records = new Map<string, z.infer<typeof recordSchema>>();
	await Promise.all(
		[...idsByObject].map(async ([object, ids]) => {
			const found = await attioRequest(
				this,
				{
					method: 'POST',
					path: `/objects/${encodeURIComponent(object)}/records/query`,
					body: { filter: { record_id: { $in: [...ids] } }, limit: ids.size },
				},
				z.array(recordSchema),
				'list',
			);
			for (const record of found) records.set(record.id.record_id, record);
		}),
	);

	// Attio leaves out records the credential's access token can't read, so those are null
	return items.map((item) => ({
		...item,
		json: {
			...item.json,
			parent_record: records.get(item.json.parent_record_id as string) ?? null,
		},
	}));
}
