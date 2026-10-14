import {
	NodeOperationError,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import { isListResponse } from '../../shared/lists';
import { attioGet } from '../../shared/request';
import { invalidValueError, isUuid } from '../../shared/validation';
import { buildAttributeValues } from '../record/attributes';

// Attio needs the parent record's object, which is fixed by the list, so it's read from there
async function getParentObject(this: IExecuteSingleFunctions, list: string): Promise<string> {
	const { name, parent_object: parentObjects } = await attioGet(
		this,
		`/lists/${encodeURIComponent(list)}`,
		isListResponse,
		'list',
	);

	// Only legacy lists allow records from more than one object
	if (parentObjects.length !== 1) {
		throw new NodeOperationError(this.getNode(), `Can't add records to the list "${name}"`, {
			description: `The list allows records from ${parentObjects.length === 0 ? 'no objects' : `more than one object (${parentObjects.join(', ')})`}, so the record's object can't be worked out`,
			itemIndex: this.getItemIndex(),
		});
	}

	return parentObjects[0];
}

export async function buildCreateListEntryBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const parentRecordId = (
		this.getNodeParameter('parentRecord', undefined, { extractValue: true }) as string
	).trim();
	if (!isUuid(parentRecordId)) {
		throw invalidValueError.call(
			this,
			'parent record ID',
			parentRecordId,
			'Use a record ID, for example bf071e1f-6035-429d-b874-d83ea64ea13b',
		);
	}

	// Values are checked before fetching the list, so invalid ones fail without a request
	const entryValues = buildAttributeValues.call(this, 'entryValues');
	const list = this.getNodeParameter('list') as string;

	// An entry can be created without values, so unlike records none are required
	requestOptions.body = {
		data: {
			parent_object: await getParentObject.call(this, list),
			parent_record_id: parentRecordId,
			entry_values: entryValues,
		},
	};

	return requestOptions;
}
