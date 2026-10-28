import {
	NodeOperationError,
	type NodeApiError,
	validateFieldType,
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
import { attioGetList, isObject } from '../../shared/request';

export type AttributeResponse = {
	id: { attribute_id: string };
	title: string;
	api_slug: string;
	type: string;
	is_writable: boolean;
	is_required: boolean;
	is_unique: boolean;
	is_multiselect: boolean;
	is_default_value_enabled: boolean;
};

type AttributeOptionResponse = {
	title: string;
};

export function isAttributeResponse(value: unknown): value is AttributeResponse {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.attribute_id === 'string' &&
		typeof value.title === 'string' &&
		typeof value.api_slug === 'string' &&
		typeof value.type === 'string' &&
		typeof value.is_writable === 'boolean' &&
		typeof value.is_required === 'boolean' &&
		typeof value.is_unique === 'boolean' &&
		typeof value.is_multiselect === 'boolean' &&
		typeof value.is_default_value_enabled === 'boolean'
	);
}

function isAttributeOptionResponse(value: unknown): value is AttributeOptionResponse {
	return isObject(value) && typeof value.title === 'string';
}

// Every writable attribute type accepts a plain string, number or boolean shorthand,
// so values are sent as entered rather than built into Attio's value objects
function toFieldType(attribute: AttributeResponse): FieldType {
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
function toNameField(attribute: AttributeResponse, isUpdate: boolean): ResourceMapperField {
	return {
		id: `${attribute.api_slug}${nameFieldSuffix}`,
		displayName: attribute.title,
		type: 'string',
		required: !isUpdate && attribute.is_required,
		defaultMatch: false,
		canBeUsedToMatch: false,
		display: true,
	};
}

function parseNameFieldSlug(id: string): string | undefined {
	return id.endsWith(nameFieldSuffix) ? id.slice(0, -nameFieldSuffix.length) : undefined;
}

const referencesFieldSuffix = '.references';

// Record references can be written as a comma-separated list of email addresses, phone numbers
// and domains, which Attio matches to people and companies. The field id is
// "<slug>.references" so the text can be told apart and split
function toReferencesField(attribute: AttributeResponse, isUpdate: boolean): ResourceMapperField {
	return {
		id: `${attribute.api_slug}${referencesFieldSuffix}`,
		displayName: attribute.title,
		type: 'string',
		required: !isUpdate && attribute.is_required,
		defaultMatch: false,
		canBeUsedToMatch: false,
		display: true,
	};
}

function parseReferencesFieldSlug(id: string): string | undefined {
	return id.endsWith(referencesFieldSuffix)
		? id.slice(0, -referencesFieldSuffix.length)
		: undefined;
}

// Takes text like "jane@acme.com, acme.com", a JSON array, or an array from an input item.
// Strings are sent as given, for Attio to match, and objects like
// { "target_object": "deals", "target_record_id": "..." } are passed through
function toRecordReferences(
	this: IExecuteSingleFunctions,
	displayName: string,
	value: unknown,
): unknown[] {
	let references: unknown = value;
	if (typeof value === 'string') {
		const text = value.trim();
		if (text.startsWith('[') || text.startsWith('{')) {
			try {
				references = JSON.parse(text);
			} catch {
				throw new NodeOperationError(this.getNode(), `Invalid value for "${displayName}"`, {
					description:
						'Use email addresses, phone numbers or domains separated by commas, or valid JSON',
					itemIndex: this.getItemIndex(),
				});
			}
		} else {
			references = text.split(',');
		}
	}

	return (Array.isArray(references) ? references : [references])
		.map((reference: unknown) => (typeof reference === 'string' ? reference.trim() : reference))
		.filter((reference) => !isEmpty(reference));
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
	attribute: AttributeResponse,
): Promise<INodePropertyOptions[]> {
	const endpoint = attribute.type === 'status' ? 'statuses' : 'options';
	const options = await attioGetList(
		this,
		`${attributePath}/${encodeURIComponent(attribute.api_slug)}/${endpoint}`,
		isAttributeOptionResponse,
	);

	return options.map((option) => ({ name: option.title, value: option.title }));
}

export type AttributeFieldOptions = {
	// Attributes the node asks for with their own parameters
	excludedSlugs?: string[];
	// Whether record references are entered as text, rather than with Attio's value objects
	referencesAsText?: boolean;
};

async function loadAttributeFields(
	this: ILoadOptionsFunctions,
	attributePath: string,
	operation: string,
	options: AttributeFieldOptions,
): Promise<ResourceMapperField[]> {
	const isUpdate = operation === 'update';
	const excludedSlugs = options.excludedSlugs ?? [];

	const attributes = await attioGetList(this, attributePath, isAttributeResponse);

	const fields = await Promise.all(
		attributes
			// Archived attributes and options are left out unless show_archived is set
			.filter(
				(attribute) => attribute.is_writable && !excludedSlugs.includes(attribute.api_slug),
			)
			.map(async (attribute): Promise<ResourceMapperField[]> => {
				if (attribute.type === 'personal-name') return [toNameField(attribute, isUpdate)];
				if (attribute.type === 'record-reference' && options.referencesAsText) {
					return [toReferencesField(attribute, isUpdate)];
				}

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
						required: !isUpdate && attribute.is_required && !attribute.is_default_value_enabled,
						defaultMatch: false,
						canBeUsedToMatch: attribute.is_unique,
						display: true,
					},
				];
			}),
	);

	return fields.flat();
}

// Loads the writable attributes of an object or list, such as /objects/people/attributes
export async function getAttributeFields(
	this: ILoadOptionsFunctions,
	attributePath: string,
	options: AttributeFieldOptions = {},
): Promise<ResourceMapperFields> {
	const operation = this.getNodeParameter('operation', '') as string;

	try {
		return { fields: await loadAttributeFields.call(this, attributePath, operation, options) };
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

export async function getRecordAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const object = this.getNodeParameter('object', '') as string;
	if (!object) {
		return { fields: [], emptyFieldsNotice: 'Choose an object to see its attributes' };
	}

	return await getAttributeFields.call(this, `/objects/${encodeURIComponent(object)}/attributes`);
}

function isEmpty(value: unknown): boolean {
	return (
		value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
	);
}

// Converts the resource mapper's values, given under the parameter `name`, into Attio's
// values object, leaving out empty ones
export function buildAttributeValues(this: IExecuteSingleFunctions, name: string): IDataObject {
	const mapper = this.getNodeParameter(name) as ResourceMapperValue;
	const autoMap = mapper.mappingMode === 'autoMapInputData';
	const source = autoMap ? this.getInputData().json : (mapper.value ?? {});

	const values: IDataObject = {};

	for (const field of mapper.schema) {
		const nameSlug = parseNameFieldSlug(field.id);
		const referencesSlug = parseReferencesFieldSlug(field.id);
		const slug = nameSlug ?? referencesSlug;

		// Input items carry these in a field named after the attribute, like "name"
		const value: unknown = source[slug && autoMap ? slug : field.id];
		if (isEmpty(value)) continue;

		if (nameSlug) {
			values[nameSlug] = splitFullName(String(value));
			continue;
		}

		if (referencesSlug) {
			const references = toRecordReferences.call(this, field.displayName, value);
			if (references.length > 0) values[referencesSlug] = references as IDataObject[];
			continue;
		}

		// n8n's own conversion, which it only applies to manually mapped values, so auto-mapped
		// input is converted the same way. Arrays arrive as JSON text from the editor
		const result = validateFieldType(field.displayName, value, field.type ?? 'string', {
			valueOptions: field.options,
		});
		if (!result.valid) {
			throw new NodeOperationError(this.getNode(), `Invalid value for "${field.displayName}"`, {
				description: result.errorMessage,
				itemIndex: this.getItemIndex(),
			});
		}

		values[field.id] = result.newValue as IDataObject[string];
	}

	return values;
}

export async function buildRecordValuesBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const values = buildAttributeValues.call(this, 'values');

	if (Object.keys(values).length === 0) {
		const mapper = this.getNodeParameter('values') as ResourceMapperValue;
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

export async function buildRecordUpsertRequest(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const mapper = this.getNodeParameter('values') as ResourceMapperValue;
	const [matchingAttribute] = mapper.matchingColumns ?? [];
	if (!matchingAttribute) {
		throw new NodeOperationError(this.getNode(), 'No attribute to match on', {
			description: 'Choose a unique attribute under "Attribute to Match On"',
			itemIndex: this.getItemIndex(),
		});
	}

	await buildRecordValuesBody.call(this, requestOptions);

	requestOptions.qs = { ...requestOptions.qs, matching_attribute: matchingAttribute };

	return requestOptions;
}
