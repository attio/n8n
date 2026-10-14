import {
	jsonParse,
	NodeOperationError,
	validateFieldType,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
} from 'n8n-workflow';
import { isAttributeResponse, type AttributeResponse } from '../resources/record/attributes';
import { isListResponse } from './lists';
import { attioGet, attioGetList, isObject } from './request';

type FilterCondition = {
	attribute: string;
	field?: string;
	operator: string;
	value?: unknown;
};

type SortRule = {
	attribute: string;
	field?: string;
	direction: 'asc' | 'desc';
};

type ObjectResponse = {
	id: { object_id: string };
	api_slug: string | null;
};

function isObjectResponse(value: unknown): value is ObjectResponse {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.object_id === 'string' &&
		(typeof value.api_slug === 'string' || value.api_slug === null)
	);
}

// Attio has no negative operators, so those wrap the positive one in $not
const filterOperators: Record<string, { operator: string; negate?: boolean }> = {
	equals: { operator: '$eq' },
	notEquals: { operator: '$eq', negate: true },
	contains: { operator: '$contains' },
	notContains: { operator: '$contains', negate: true },
	startsWith: { operator: '$starts_with' },
	endsWith: { operator: '$ends_with' },
	isOneOf: { operator: '$in' },
	greaterThan: { operator: '$gt' },
	greaterThanOrEqual: { operator: '$gte' },
	lessThan: { operator: '$lt' },
	lessThanOrEqual: { operator: '$lte' },
	isNotEmpty: { operator: '$not_empty' },
	isEmpty: { operator: '$not_empty', negate: true },
};

// Attribute types whose filter values aren't strings
const filterValueTypes: Partial<Record<string, 'number' | 'boolean'>> = {
	number: 'number',
	currency: 'number',
	rating: 'number',
	checkbox: 'boolean',
};

// The fields offered for each attribute type, from Attio's docs and testing against the API. A
// field without a property is the whole value. The first is the default and is stored as an empty
// field, so an empty field stays valid whichever attribute is chosen
type FieldChoice = { title: string; property?: string };

const wholeValue: FieldChoice = { title: 'Whole Value' };

const filterFields: Partial<Record<string, FieldChoice[]>> = {
	// Attio can't compare an actor reference as a whole
	'actor-reference': [
		{ title: 'Actor ID', property: 'referenced_actor_id' },
		{ title: 'Actor Type', property: 'referenced_actor_type' },
	],
	domain: [wholeValue, { title: 'Root Domain', property: 'root_domain' }],
	'email-address': [
		wholeValue,
		{ title: 'Domain', property: 'email_domain' },
		{ title: 'Root Domain', property: 'email_root_domain' },
		{ title: 'Local Part', property: 'email_local_specifier' },
	],
	interaction: [
		wholeValue,
		{ title: 'Date', property: 'interacted_at' },
		{ title: 'Type', property: 'interaction_type' },
	],
	location: [
		wholeValue,
		{ title: 'Address Line 1', property: 'line_1' },
		{ title: 'City', property: 'locality' },
		{ title: 'Region', property: 'region' },
		{ title: 'Postcode', property: 'postcode' },
		{ title: 'Country Code', property: 'country_code' },
	],
	'personal-name': [
		wholeValue,
		{ title: 'First Name', property: 'first_name' },
		{ title: 'Last Name', property: 'last_name' },
	],
	'phone-number': [wholeValue, { title: 'Country Code', property: 'country_code' }],
};

// Attio sorts on fewer fields than it filters on, and can't sort an interaction or location as a
// whole. Other sortable types only sort on the whole value
const sortFields: Partial<Record<string, FieldChoice[]>> = {
	interaction: [{ title: 'Date', property: 'interacted_at' }],
	location: [
		{ title: 'City', property: 'locality' },
		{ title: 'Region', property: 'region' },
		{ title: 'Country Code', property: 'country_code' },
	],
	'personal-name': [
		wholeValue,
		{ title: 'First Name', property: 'first_name' },
		{ title: 'Last Name', property: 'last_name' },
	],
};

function fieldOptions(choices: FieldChoice[] = [wholeValue]): INodePropertyOptions[] {
	return choices.map(({ title, property }, index) => ({
		name: title,
		value: index === 0 ? '' : (property ?? ''),
	}));
}

// An empty field is the attribute type's default
function resolveField(
	choices: FieldChoice[] | undefined,
	field: string | undefined,
): string | undefined {
	return field?.trim() || choices?.[0]?.property;
}

// A record reference has no value of its own to compare, so it's matched on the referenced
// record's ID, or through a path on the domain of a referenced company or the email address of a
// referenced person. The record ID is the default, so an empty field means target_record_id
type ReferenceField = 'target_record_id' | 'domain' | 'email_address';

function isReferenceField(field: string): field is ReferenceField {
	return field === 'target_record_id' || field === 'domain' || field === 'email_address';
}

const referencePaths: Record<Exclude<ReferenceField, 'target_record_id'>, [string, string]> = {
	domain: ['companies', 'domains'],
	email_address: ['people', 'email_addresses'],
};

// Records are queried on an object and list entries on a list. Either is the first step of a
// filter or sort path
function getQueryParent(context: ILoadOptionsFunctions | IExecuteSingleFunctions): {
	parent: string;
	isList: boolean;
} {
	const isList = context.getNodeParameter('resource', '') === 'listEntry';
	return { parent: context.getNodeParameter(isList ? 'list' : 'object', '') as string, isList };
}

// List entries can also be filtered and sorted on the record they belong to, through Attio's
// parent_record attribute. It isn't one of the list's attributes, so it's added here as a record
// reference to the list's object, which it acts like
const parentRecordSlug = 'parent_record';

function parentRecordAttribute(object: string): AttributeResponse {
	return {
		id: { attribute_id: parentRecordSlug },
		title: 'Parent Record',
		api_slug: parentRecordSlug,
		type: 'record-reference',
		is_writable: false,
		is_required: false,
		is_unique: false,
		is_multiselect: false,
		is_default_value_enabled: false,
		config: { record_reference: { allowed_object_ids: [object] } },
	} as AttributeResponse;
}

// The attributes that can be filtered and sorted on
async function loadQueryAttributes(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	parent: string,
	isList: boolean,
): Promise<AttributeResponse[]> {
	const collection = isList ? 'lists' : 'objects';
	const path = `/${collection}/${encodeURIComponent(parent)}`;
	if (!isList) return await attioGetList(context, `${path}/attributes`, isAttributeResponse);

	const [attributes, list] = await Promise.all([
		attioGetList(context, `${path}/attributes`, isAttributeResponse),
		attioGet(context, path, isListResponse, 'list'),
	]);

	// Legacy lists for more than one object have no single object to reference
	return list.parent_object.length === 1
		? [parentRecordAttribute(list.parent_object[0]), ...attributes]
		: attributes;
}

// Attributes can be given by slug or ID, like everywhere else in Attio's API
function byKey(attributes: AttributeResponse[]): Map<string, AttributeResponse> {
	return new Map(
		attributes.flatMap((attribute) => [
			[attribute.api_slug, attribute],
			[attribute.id.attribute_id, attribute],
		]),
	);
}

// Record reference attributes list the objects they can reference; an empty list allows any
function allowedObjectIds(attribute: AttributeResponse): string[] {
	const { config } = attribute as AttributeResponse & { config?: unknown };
	if (!isObject(config) || !isObject(config.record_reference)) return [];

	const ids = config.record_reference.allowed_object_ids;
	return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

async function attributeOptions(
	this: ILoadOptionsFunctions,
	include: (attribute: AttributeResponse) => boolean,
): Promise<INodePropertyOptions[]> {
	const { parent, isList } = getQueryParent(this);
	if (!parent) return [];

	const attributes = await loadQueryAttributes(this, parent, isList);

	return attributes
		.filter(include)
		.map((attribute) => ({ name: attribute.title, value: attribute.api_slug }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

// Every attribute can be filtered on, including read-only ones like "Created at"
export async function getQueryAttributes(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return await attributeOptions.call(this, () => true);
}

// Actor references only sort by ID, which isn't useful. Record references sort by the name of the
// referenced record, through a path, so need to reference a single object
function isSortable(attribute: AttributeResponse): boolean {
	if (attribute.type === 'actor-reference') return false;
	if (attribute.type === 'record-reference') return allowedObjectIds(attribute).length === 1;
	return true;
}

export async function getQuerySortAttributes(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	return await attributeOptions.call(this, isSortable);
}

// The attribute chosen next to the field being loaded, in the same condition or sort rule
async function loadSiblingAttribute(
	this: ILoadOptionsFunctions,
): Promise<AttributeResponse | undefined> {
	const { parent, isList } = getQueryParent(this);
	const slug = this.getCurrentNodeParameter('&attribute');
	if (!parent || typeof slug !== 'string' || !slug) return undefined;

	const attributes = await loadQueryAttributes(this, parent, isList);
	return byKey(attributes).get(slug);
}

export async function getQueryFilterFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const attribute = await loadSiblingAttribute.call(this);
	if (attribute?.type !== 'record-reference') {
		return fieldOptions(attribute && filterFields[attribute.type]);
	}

	// Domain and email address are only offered when companies or people can be referenced. The
	// parent record references its list's object by slug rather than ID
	const allowedIds = allowedObjectIds(attribute);
	const objects = await attioGetList(this, '/objects', isObjectResponse);
	const allowedSlugs = new Set(
		objects
			.filter(
				(object) =>
					allowedIds.length === 0 ||
					allowedIds.includes(object.id.object_id) ||
					(object.api_slug !== null && allowedIds.includes(object.api_slug)),
			)
			.map((object) => object.api_slug),
	);

	return [
		{ name: 'Record ID', value: '' },
		...(allowedSlugs.has('companies')
			? [
					{
						name: 'Company Domain',
						value: 'domain',
						description: 'Domain of the referenced company',
					},
				]
			: []),
		...(allowedSlugs.has('people')
			? [
					{
						name: 'Person Email Address',
						value: 'email_address',
						description: 'Email address of the referenced person',
					},
				]
			: []),
	];
}

export async function getQuerySortFields(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const attribute = await loadSiblingAttribute.call(this);
	if (attribute?.type === 'record-reference') {
		return [{ name: 'Name', value: '', description: 'Name of the referenced record' }];
	}

	return fieldOptions(attribute && sortFields[attribute.type]);
}

// Values are entered as text, but Attio compares numbers and checkboxes against JSON numbers
// and booleans. Properties can have a different type to their attribute, so are sent as entered
function toFilterValue(
	this: IExecuteSingleFunctions,
	value: unknown,
	attribute: AttributeResponse | undefined,
	hasProperty: boolean,
): IDataObject[string] {
	if (!attribute || hasProperty) return value as IDataObject[string];

	const type = filterValueTypes[attribute.type];
	if (!type) return value as IDataObject[string];

	const result = validateFieldType(attribute.title, value, type);
	if (!result.valid) {
		throw new NodeOperationError(this.getNode(), `Invalid filter value for "${attribute.title}"`, {
			description: result.errorMessage,
			itemIndex: this.getItemIndex(),
		});
	}

	return result.newValue as IDataObject[string];
}

function isMissingValue(operator: string, value: unknown): boolean {
	if (operator === '$not_empty') return false;
	if (operator === '$in') return toList(value).length === 0;
	return value === undefined || value === null || String(value).trim() === '';
}

function toList(value: unknown): unknown[] {
	if (Array.isArray(value)) return value;

	return String(value ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function toReferenceFilter(
	parent: string,
	attribute: AttributeResponse,
	field: ReferenceField,
	operator: string,
	value: string | string[],
): IDataObject {
	const slug = attribute.api_slug;

	// Attio's guide matches a parent record on its record_id, through a path. Equality uses the
	// guide's shorthand
	if (field === 'target_record_id' && slug === parentRecordSlug) {
		return {
			path: [
				[parent, slug],
				[allowedObjectIds(attribute)[0], 'record_id'],
			],
			constraints: { value: operator === '$eq' ? value : { [operator]: value } },
		};
	}

	if (field === 'target_record_id') {
		return { [slug]: { target_record_id: { [operator]: value } } };
	}

	return {
		path: [[parent, slug], referencePaths[field]],
		constraints: { [field]: { [operator]: value } },
	};
}

function buildReferenceFilter(
	parent: string,
	attribute: AttributeResponse,
	field: ReferenceField,
	operator: string,
	rawValue: unknown,
): IDataObject {
	if (operator !== '$in')
		return toReferenceFilter(parent, attribute, field, operator, String(rawValue ?? ''));

	const values = toList(rawValue).map(String);
	if (field === 'target_record_id' && attribute.api_slug !== parentRecordSlug) {
		return toReferenceFilter(parent, attribute, field, '$in', values);
	}

	// Only record reference IDs support $in, so parent records, domains and email addresses are
	// matched one by one
	return { $or: values.map((value) => toReferenceFilter(parent, attribute, field, '$eq', value)) };
}

function buildConditionsFilter(
	this: IExecuteSingleFunctions,
	parent: string,
	conditions: FilterCondition[],
	attributesByKey: Map<string, AttributeResponse>,
): IDataObject {
	const filters = conditions.map((condition): IDataObject => {
		const { operator, negate } = filterOperators[condition.operator];
		const attribute = attributesByKey.get(condition.attribute);
		const slug = attribute?.api_slug ?? condition.attribute;

		// Otherwise a number attribute compares against 0, as n8n reads an empty number as 0, and
		// returns the wrong records without an error
		if (isMissingValue(operator, condition.value)) {
			throw new NodeOperationError(
				this.getNode(),
				`No value to compare "${attribute?.title ?? condition.attribute}" with`,
				{
					description: 'Enter a value for the condition, or remove it',
					itemIndex: this.getItemIndex(),
				},
			);
		}

		let filter: IDataObject;
		if (attribute?.type === 'record-reference') {
			// Tested against the API: no field or path of a record reference accepts $not_empty
			if (operator === '$not_empty') {
				throw new NodeOperationError(
					this.getNode(),
					`"${attribute.title}" can't be checked for being empty`,
					{
						description:
							"Attio doesn't support Is Empty or Is Not Empty on record references. Use another operator.",
						itemIndex: this.getItemIndex(),
					},
				);
			}

			// A field kept from another attribute type would otherwise build a broken path
			const field = condition.field?.trim() || 'target_record_id';
			if (!isReferenceField(field)) {
				throw new NodeOperationError(
					this.getNode(),
					`Field "${field}" can't be used with "${attribute.title}"`,
					{
						description:
							'Record references compare the record ID, or the domain or email address of the referenced company or person. Choose one under "Field".',
						itemIndex: this.getItemIndex(),
					},
				);
			}

			filter = buildReferenceFilter(parent, attribute, field, operator, condition.value);
		} else {
			const field = resolveField(attribute && filterFields[attribute.type], condition.field);
			const toValue = (value: unknown) =>
				toFilterValue.call(this, value, attribute, Boolean(field));

			let constraint: IDataObject = {
				[operator]:
					operator === '$not_empty'
						? true
						: operator === '$in'
							? toList(condition.value).map(toValue)
							: toValue(condition.value),
			};
			if (field) constraint = { [field]: constraint };

			filter = { [slug]: constraint };
		}

		return negate ? { $not: filter } : filter;
	});

	const combinator = this.getNodeParameter('matchType', 'all') === 'any' ? '$or' : '$and';

	return { [combinator]: filters };
}

function parseJsonFilter(this: IExecuteSingleFunctions): IDataObject {
	const value = this.getNodeParameter('filterJson') as unknown;
	const filter = typeof value === 'string' ? jsonParse<unknown>(value) : value;
	if (!isObject(filter)) {
		throw new NodeOperationError(this.getNode(), 'Invalid filter JSON', {
			description: 'The filter must be a JSON object, like { "name": { "$contains": "Acme" } }',
			itemIndex: this.getItemIndex(),
		});
	}

	return filter as IDataObject;
}

function buildSorts(
	this: IExecuteSingleFunctions,
	parent: string,
	rules: SortRule[],
	attributesByKey: Map<string, AttributeResponse>,
): IDataObject[] {
	return rules.map(({ attribute: key, field, direction }) => {
		const attribute = attributesByKey.get(key);
		const slug = attribute?.api_slug ?? key;

		if (attribute?.type === 'record-reference') {
			const [target, ...others] = allowedObjectIds(attribute);
			if (!target || others.length > 0) {
				throw new NodeOperationError(this.getNode(), `Can't sort by "${attribute.title}"`, {
					description: 'Only record references to a single object can be sorted, by record name',
					itemIndex: this.getItemIndex(),
				});
			}

			// Paths take object IDs as well as slugs
			return {
				path: [
					[parent, slug],
					[target, 'name'],
				],
				direction,
			};
		}

		const property = resolveField(attribute && sortFields[attribute.type], field);
		return { attribute: slug, direction, ...(property && { field: property }) };
	});
}

export async function buildQueryBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body: IDataObject = {};
	const { parent, isList } = getQueryParent(this);
	const filterType = this.getNodeParameter('filterType') as string;
	const conditions =
		filterType === 'conditions'
			? (this.getNodeParameter('conditions.condition', []) as FilterCondition[])
			: [];
	const sortRules = this.getNodeParameter('sort.rule', []) as SortRule[];

	// Attribute types decide how values are converted and which fields are used by default
	const attributes =
		conditions.length > 0 || sortRules.length > 0
			? await loadQueryAttributes(this, parent, isList)
			: [];
	const attributesByKey = byKey(attributes);

	switch (filterType) {
		case 'conditions':
			if (conditions.length > 0) {
				body.filter = buildConditionsFilter.call(this, parent, conditions, attributesByKey);
			}
			break;
		case 'json':
			body.filter = parseJsonFilter.call(this);
			break;
		case 'view':
			body.filter_view_id = this.getNodeParameter('viewId') as string;
			break;
	}

	if (sortRules.length > 0) {
		body.sorts = buildSorts.call(this, parent, sortRules, attributesByKey);
	}

	// Pagination adds limit and offset to this body
	requestOptions.body = body;

	return requestOptions;
}
