import {
	NodeOperationError,
	tryToParseBoolean,
	tryToParseNumber,
	type FieldType,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	type ResourceMapperField,
	type ResourceMapperFields,
	type ResourceMapperValue,
} from 'n8n-workflow';
import { attioGet } from '../../shared/request';

type Attribute = {
	title: string;
	api_slug: string;
	type: string;
	is_writable: boolean;
	is_archived: boolean;
	is_required: boolean;
	is_multiselect: boolean;
	is_default_value_enabled: boolean;
};

type AttributeOption = {
	title: string;
	is_archived: boolean;
};

// Every writable attribute type accepts a plain string, number or boolean shorthand,
// so values are sent as entered rather than built into Attio's value objects
function toFieldType(attribute: Attribute): FieldType {
	if (attribute.is_multiselect) return 'array';

	switch (attribute.type) {
		case 'number':
		case 'currency':
		case 'rating':
			return 'number';
		case 'checkbox':
			return 'boolean';
		case 'date':
		case 'timestamp':
			return 'dateTime';
		case 'select':
		case 'status':
			return 'options';
		default:
			return 'string';
	}
}

// The string shorthand for names is "Last, First"; without a comma it's all first name
function toDisplayName(attribute: Attribute): string {
	return attribute.type === 'personal-name' ? `${attribute.title} (Last, First)` : attribute.title;
}

async function loadOptions(
	this: ILoadOptionsFunctions,
	attributePath: string,
	attribute: Attribute,
): Promise<INodePropertyOptions[]> {
	const endpoint = attribute.type === 'status' ? 'statuses' : 'options';
	const options = (await attioGet.call(
		this,
		`${attributePath}/${encodeURIComponent(attribute.api_slug)}/${endpoint}`,
	)) as AttributeOption[];

	return options
		.filter((option) => !option.is_archived)
		.map((option) => ({ name: option.title, value: option.title }));
}

export async function getRecordAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const object = this.getNodeParameter('object', '') as string;
	if (!object) {
		return { fields: [], emptyFieldsNotice: 'Choose an object to see its attributes' };
	}

	const attributePath = `/objects/${encodeURIComponent(object)}/attributes`;
	const attributes = (await attioGet.call(this, attributePath)) as Attribute[];

	const fields = await Promise.all(
		attributes
			.filter((attribute) => attribute.is_writable && !attribute.is_archived)
			.map(async (attribute): Promise<ResourceMapperField> => {
				const type = toFieldType(attribute);

				return {
					id: attribute.api_slug,
					displayName: toDisplayName(attribute),
					type,
					options:
						type === 'options' ? await loadOptions.call(this, attributePath, attribute) : undefined,
					// Attio fills required attributes that have a default value itself
					required: attribute.is_required && !attribute.is_default_value_enabled,
					defaultMatch: false,
					display: true,
				};
			}),
	);

	return { fields };
}

function isEmpty(value: unknown): boolean {
	return (
		value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
	);
}

function toArray(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;
	if (typeof value === 'string' && value.trim().startsWith('[')) {
		const parsed: unknown = JSON.parse(value);
		if (Array.isArray(parsed)) return parsed;
	}

	return [value];
}

function toAttioValue(field: ResourceMapperField, value: unknown): unknown {
	switch (field.type) {
		case 'array':
			return toArray(value);
		case 'number':
			return tryToParseNumber(value);
		case 'boolean':
			return tryToParseBoolean(value);
		default:
			return value;
	}
}

export async function buildRecordValuesBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const mapper = this.getNodeParameter('values') as ResourceMapperValue;
	const source =
		mapper.mappingMode === 'autoMapInputData' ? this.getInputData().json : (mapper.value ?? {});

	const values: IDataObject = {};
	for (const field of mapper.schema) {
		const value: unknown = source[field.id];
		if (isEmpty(value)) continue;

		try {
			values[field.id] = toAttioValue(field, value) as IDataObject[string];
		} catch {
			throw new NodeOperationError(this.getNode(), `Invalid value for "${field.displayName}"`, {
				description: `Expected a ${field.type}, got ${JSON.stringify(value)}`,
				itemIndex: this.getItemIndex(),
			});
		}
	}

	if (Object.keys(values).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No attribute values to write', {
			description:
				mapper.mappingMode === 'autoMapInputData'
					? "None of the input item's fields match an attribute slug on this object"
					: 'Add at least one attribute under "Attributes"',
			itemIndex: this.getItemIndex(),
		});
	}

	requestOptions.body = { data: { values } };

	return requestOptions;
}
