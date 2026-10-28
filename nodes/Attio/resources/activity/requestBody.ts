import {
	jsonParse,
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type INodeParameterResourceLocator,
} from 'n8n-workflow';
import { isObject } from '../../shared/request';
import { invalidValueError, isEmail, isUuid } from '../../shared/validation';
import { buildAttributeValues } from '../record/attributes';

type LinkedRecordsParameter = {
	record?: Array<{ object: string; record: INodeParameterResourceLocator }>;
};

// A domain such as acme.com or app.acme.co.uk, without a protocol or path
const domainPattern = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

// Email addresses and domains use Attio's matching format, which links the record with that
// value and fails if none or several have it
function toLinkedRecord(
	this: IExecuteSingleFunctions,
	object: string,
	record: INodeParameterResourceLocator,
): IDataObject {
	const target_object = object.trim();
	const value = String(record.value ?? '').trim();

	if (record.mode !== 'match') {
		if (!isUuid(value)) {
			throw invalidValueError.call(
				this,
				'linked record ID',
				value,
				'Use a record ID, for example bf071e1f-6035-429d-b874-d83ea64ea13b',
			);
		}
		return { target_object, target_record_id: value };
	}

	if (target_object === 'people' && isEmail(value)) {
		return { target_object, email_addresses: [{ email_address: value }] };
	}
	if (target_object === 'companies' && domainPattern.test(value)) {
		return { target_object, domains: [{ domain: value }] };
	}

	throw invalidValueError.call(
		this,
		'linked record',
		value,
		'Use an email address with People, or a domain with Companies. To link a record of another object, choose it from the list or use its ID.',
	);
}

// Items are passed to Attio as given, so any record reference it accepts can be used
function parseLinkedRecordsJson(this: IExecuteSingleFunctions): unknown[] {
	const value = this.getNodeParameter('linkedRecordsJson') as unknown;
	let linkedRecords: unknown = value;
	if (typeof value === 'string') {
		try {
			linkedRecords = jsonParse<unknown>(value);
		} catch {
			linkedRecords = undefined;
		}
	}

	if (
		!Array.isArray(linkedRecords) ||
		!linkedRecords.every((item) => isObject(item) || typeof item === 'string')
	) {
		throw new NodeOperationError(this.getNode(), 'Invalid linked records JSON', {
			description: `'Linked Records (JSON)' must be an array of email addresses, domains or record references. For the record reference syntax, see https://docs.attio.com/rest-api/guides/activities#linking-records-by-attribute-value`,
			itemIndex: this.getItemIndex(),
		});
	}

	return linkedRecords;
}

function getLinkedRecords(this: IExecuteSingleFunctions): unknown[] {
	if (this.getNodeParameter('linkedRecordsType', 'define') === 'json') {
		return parseLinkedRecordsJson.call(this);
	}

	const linkedRecords = this.getNodeParameter(
		'activityLinkedRecords',
		{},
	) as LinkedRecordsParameter;
	return (linkedRecords.record ?? []).map(({ object, record }) =>
		toLinkedRecord.call(this, object, record),
	);
}

export async function buildActivityRecordBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const linkedRecords = getLinkedRecords.call(this);
	if (linkedRecords.length === 0) {
		throw new NodeOperationError(this.getNode(), 'No linked records', {
			description: "Add at least one record under 'Linked Records', such as a person or company",
			itemIndex: this.getItemIndex(),
		});
	}

	const values: IDataObject = {
		...buildAttributeValues.call(this, 'activityValues'),
		linked_records: linkedRecords as IDataObject[],
	};

	requestOptions.body = { data: { values } };

	return requestOptions;
}
