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

type AttributeResponse = {
	title: string;
	api_slug: string;
	type: string;
	is_writable: boolean;
	is_required: boolean;
	is_multiselect: boolean;
	is_default_value_enabled: boolean;
};

type AttributeOptionResponse = {
	title: string;
};

function isAttributeResponse(value: unknown): value is AttributeResponse {
	return (
		isObject(value) &&
		typeof value.title === 'string' &&
		typeof value.api_slug === 'string' &&
		typeof value.type === 'string' &&
		typeof value.is_writable === 'boolean' &&
		typeof value.is_required === 'boolean' &&
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
function toNameField(attribute: AttributeResponse): ResourceMapperField {
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

async function loadAttributeFields(
	this: ILoadOptionsFunctions,
	object: string,
): Promise<ResourceMapperField[]> {
	const attributePath = `/objects/${encodeURIComponent(object)}/attributes`;
	const attributes = await attioGetList(this, attributePath, isAttributeResponse);

	const fields = await Promise.all(
		attributes
			// Archived attributes and options are left out unless show_archived is set
			.filter((attribute) => attribute.is_writable)
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
