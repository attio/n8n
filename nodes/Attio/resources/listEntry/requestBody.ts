import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { getListParentObject } from '../../shared/lists';
import { invalidValueError, isUuid } from '../../shared/validation';
import { buildAttributeValues } from '../record/attributes';

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
			// Attio needs the parent record's object, which is fixed by the list
			parent_object: await getListParentObject(this, list),
			parent_record_id: parentRecordId,
			entry_values: entryValues,
		},
	};

	return requestOptions;
}

// Checked before the request, so a mistyped ID gets a clear error rather than Attio's 404
export async function validateEntryId(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const entryId = (this.getNodeParameter('entryId') as string).trim();
	if (!isUuid(entryId)) {
		throw invalidValueError.call(
			this,
			'entry ID',
			entryId,
			'Use a list entry ID, for example 2e6e29ea-c4e0-4f44-842d-78a891f8c156',
		);
	}

	return requestOptions;
}
