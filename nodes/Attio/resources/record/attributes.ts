import {
	NodeOperationError,
	type NodeApiError,
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

const nameFieldSuffix = '.full_name';

// Name attributes take a full name in "First Last" order rather than Attio's "Last, First"
// string shorthand. The field id is "<slug>.full_name" so the name can be told apart and split
function toNameField(attribute: Attribute): ResourceMapperField {
	return {
		id: `${attribute.api_slug}${nameFieldSuffix}`,
		displayName: attribute.title,
		type: 'string',
		required: attribute.is_required,
		defaultMatch: false,
		display: true,
	};
}

function parseNameFieldSlug(id: string): string | undefined {
	return id.endsWith(nameFieldSuffix) ? id.slice(0, -nameFieldSuffix.length) : undefined;
}

type Name = Record<'first_name' | 'last_name' | 'full_name', string>;

// The last word is the last name and the rest is the first name. The full name is kept as
// given, which is how Attio displays it. Attio's object syntax for names needs all three
function splitFullName(fullName: string): Name {
	const full_name = fullName.trim().replace(/\s+/g, ' ');
	const lastSpace = full_name.lastIndexOf(' ');

	const [first_name, last_name] =
		lastSpace === -1
			? [full_name, '']
			: [full_name.slice(0, lastSpace), full_name.slice(lastSpace + 1)];

	return { first_name, last_name, full_name };
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

async function loadAttributeFields(
	this: ILoadOptionsFunctions,
	object: string,
): Promise<ResourceMapperField[]> {
	const attributePath = `/objects/${encodeURIComponent(object)}/attributes`;
	const attributes = (await attioGet.call(this, attributePath)) as Attribute[];

	const fields = await Promise.all(
		attributes
			.filter((attribute) => attribute.is_writable && !attribute.is_archived)
			.map(async (attribute): Promise<ResourceMapperField[]> => {
				if (attribute.type === 'personal-name') return [toNameField(attribute)];

				const type = toFieldType(attribute);

				return [
					{
						id: attribute.api_slug,
						displayName: attribute.title,
						type,
						options:
							type === 'options'
								? await loadOptions.call(this, attributePath, attribute)
								: undefined,
						// Attio fills required attributes that have a default value itself
						required: attribute.is_required && !attribute.is_default_value_enabled,
						defaultMatch: false,
						display: true,
					},
				];
			}),
	);

	return fields.flat();
}

export async function getRecordAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const object = this.getNodeParameter('object', '') as string;
	if (!object) {
		return { fields: [], emptyFieldsNotice: 'Choose an object to see its attributes' };
	}

	try {
		return { fields: await loadAttributeFields.call(this, object) };
	} catch (error) {
		// The editor drops errors from this method and only says there are no fields,
		// so the reason is passed back as the notice instead
		const { message, description } = error as NodeApiError;
		return {
			fields: [],
			emptyFieldsNotice: `Couldn't load attributes: ${[message, description].filter(Boolean).join(' – ')}`,
		};
	}
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
	const autoMap = mapper.mappingMode === 'autoMapInputData';
	const source = autoMap ? this.getInputData().json : (mapper.value ?? {});

	const values: IDataObject = {};

	for (const field of mapper.schema) {
		const nameSlug = parseNameFieldSlug(field.id);

		// Input items carry a name in a field named after the attribute, like "name"
		const value: unknown = source[nameSlug && autoMap ? nameSlug : field.id];
		if (isEmpty(value)) continue;

		if (nameSlug) {
			values[nameSlug] = splitFullName(String(value));
			continue;
		}

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
			description: autoMap
				? "None of the input item's fields match an attribute slug on this object"
				: 'Add at least one attribute under "Attributes"',
			itemIndex: this.getItemIndex(),
		});
	}

	requestOptions.body = { data: { values } };

	return requestOptions;
}
