import type { INodeProperties, ResourceMapperTypeOptions } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { offsetPagination, returnAllFields } from '../../shared/pagination';
import { buildRecordUpsertRequest, buildRecordValuesBody } from './attributes';
import { buildRecordQueryBody } from './query';

const recordsUrl = '=/objects/{{ encodeURIComponent($parameter.object) }}/records';

const queryAttributeOptions = {
	loadOptionsMethod: 'getQueryAttributes',
	loadOptionsDependsOn: ['object'],
};

const sortAttributeOptions = {
	loadOptionsMethod: 'getQuerySortAttributes',
	loadOptionsDependsOn: ['object'],
};

const queryPagination = offsetPagination(500, 'body');

const recordUrl =
	'=/objects/{{ encodeURIComponent($parameter.object) }}/records/{{ encodeURIComponent($parameter.recordId) }}';

// Create or update needs its own mapper, as only the upsert mode asks for an attribute to match on
function attributesMapper(mode: 'add' | 'upsert', operations: string[]): INodeProperties {
	const resourceMapper: ResourceMapperTypeOptions = {
		resourceMapperMethod: 'getRecordAttributes',
		mode,
		fieldWords: {
			singular: 'attribute',
			plural: 'attributes',
		},
		addAllFields: false,
		supportAutoMap: true,
		noFieldsError: 'This object has no writable attributes',
	};

	if (mode === 'upsert') {
		// Attio matches on a single attribute
		resourceMapper.multiKeyMatch = false;
		resourceMapper.matchingFieldsLabels = {
			title: 'Attribute to Match On',
			description:
				'A unique attribute, such as an email address or domain. A record with the same value is updated, otherwise a new record is created.',
			// The editor can't add a hint to a single attribute, so this covers the
			// multi-value ones that are usually matched on
			hint: 'Email addresses, domains and other multi-value attributes take an array, like ["jane@acme.com"]',
		};
	}

	return {
		displayName: 'Attributes',
		name: 'values',
		type: 'resourceMapper',
		noDataExpression: true,
		required: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		description:
			'Values to set, keyed by attribute. Multi-value attributes take an array. Record references take a domain (companies), email address (people) or an object like { "target_object": "deals", "target_record_id": "..." }.',
		typeOptions: {
			// Which attributes are required depends on the operation
			loadOptionsDependsOn: ['object', 'operation'],
			resourceMapper,
		},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: operations,
			},
			// Otherwise the mapper reports the object as having no writable attributes
			hide: {
				object: [''],
			},
		},
	};
}

export const recordDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['record'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a record',
				action: 'Create a record',
				routing: {
					request: {
						method: 'POST',
						url: recordsUrl,
					},
					send: {
						preSend: [buildRecordValuesBody],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Create or Update',
				value: 'upsert',
				description: 'Create a new record, or update the current one if it already exists (upsert)',
				action: 'Create or update a record',
				routing: {
					request: {
						method: 'PUT',
						url: recordsUrl,
					},
					send: {
						preSend: [buildRecordUpsertRequest],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a record',
				action: 'Delete a record',
				routing: {
					request: {
						method: 'DELETE',
						url: recordUrl,
					},
					output: {
						postReceive: [deletedResponse],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a record',
				action: 'Get a record',
				routing: {
					request: {
						method: 'GET',
						url: recordUrl,
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many records',
				action: 'Get many records',
				routing: {
					request: {
						method: 'POST',
						url: `${recordsUrl}/query`,
					},
					send: {
						...queryPagination.send,
						preSend: [buildRecordQueryBody],
					},
					operations: queryPagination.operations,
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a record',
				action: 'Update a record',
				// No method here, as the "Multi-Select Write Mode" option sets PATCH or PUT
				routing: {
					request: {
						url: recordUrl,
					},
					send: {
						preSend: [buildRecordValuesBody],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'Object Name or ID',
		name: 'object',
		type: 'options',
		typeOptions: objectOptions,
		required: true,
		default: '',
		description:
			'Object the record belongs to, such as people or companies. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['record'],
			},
		},
	},
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['delete', 'get', 'update'],
			},
		},
	},
	{
		displayName: 'Multi-Select Write Mode',
		name: 'multiselectMode',
		type: 'options',
		noDataExpression: true,
		default: 'append',
		description:
			"Whether values for multi-select attributes, such as email addresses or tags, are added to the record's existing values or replace them. Single-value attributes, such as job title, are always replaced.",
		options: [
			{
				name: 'Append',
				value: 'append',
				description: "Add the values to the record's existing ones",
				routing: {
					request: {
						method: 'PATCH',
					},
				},
			},
			{
				name: 'Overwrite',
				value: 'overwrite',
				description: "Replace the record's existing values",
				routing: {
					request: {
						method: 'PUT',
					},
				},
			},
		],
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['update'],
			},
		},
	},
	attributesMapper('add', ['create', 'update']),
	attributesMapper('upsert', ['upsert']),
	...returnAllFields('record'),
	{
		displayName: 'Filter',
		name: 'filterType',
		type: 'options',
		noDataExpression: true,
		default: 'none',
		options: [
			{
				name: 'None',
				value: 'none',
			},
			{
				name: 'Build Conditions',
				value: 'conditions',
				description: 'Match records against attribute conditions',
			},
			{
				name: 'JSON',
				value: 'json',
				description: "Use an Attio filter object, for conditions the builder can't express",
			},
			{
				name: 'Saved View',
				value: 'view',
				description: "Return the records in a saved view on this object, using the view's filter",
			},
		],
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
			},
		},
	},
	{
		displayName: 'Must Match',
		name: 'matchType',
		type: 'options',
		default: 'all',
		options: [
			{
				name: 'All Conditions',
				value: 'all',
			},
			{
				name: 'Any Condition',
				value: 'any',
			},
		],
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
				filterType: ['conditions'],
			},
		},
	},
	{
		displayName: 'Conditions',
		name: 'conditions',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Condition',
		default: {},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
				filterType: ['conditions'],
			},
		},
		options: [
			{
				displayName: 'Condition',
				name: 'condition',
				values: [
					{
						displayName: 'Attribute Name or ID',
						name: 'attribute',
						type: 'options',
						typeOptions: queryAttributeOptions,
						default: '',
						required: true,
						description:
							'Attribute to filter on. Choose from the list, or specify an attribute slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getQueryFilterFields',
							loadOptionsDependsOn: ['&attribute'],
						},
						default: '',
						description:
							'Part of the attribute\'s value to compare, such as the domain of an email address. Record references compare the referenced record\'s ID, or the domain or email address of a referenced company or person. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Operator',
						name: 'operator',
						type: 'options',
						default: 'equals',
						description:
							"Not every attribute type supports every operator. Attio returns an error if the attribute doesn't support it. Record references, such as a person's company, can't be checked for being empty.",
						options: [
							{
								name: 'Contains',
								value: 'contains',
							},
							{
								name: 'Does Not Contain',
								value: 'notContains',
							},
							{
								name: 'Ends With',
								value: 'endsWith',
							},
							{
								name: 'Equals',
								value: 'equals',
							},
							{
								name: 'Greater Than',
								value: 'greaterThan',
							},
							{
								name: 'Greater Than or Equal',
								value: 'greaterThanOrEqual',
							},
							{
								name: 'Is Empty',
								value: 'isEmpty',
							},
							{
								name: 'Is Not Empty',
								value: 'isNotEmpty',
							},
							{
								name: 'Is One Of',
								value: 'isOneOf',
							},
							{
								name: 'Less Than',
								value: 'lessThan',
							},
							{
								name: 'Less Than or Equal',
								value: 'lessThanOrEqual',
							},
							{
								name: 'Not Equals',
								value: 'notEquals',
							},
							{
								name: 'Starts With',
								value: 'startsWith',
							},
						],
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description:
							'Value to compare against. Dates use ISO 8601, like 2026-10-13. For "Is One Of", separate values with commas.',
						displayOptions: {
							hide: {
								operator: ['isEmpty', 'isNotEmpty'],
							},
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Filter (JSON)',
		name: 'filterJson',
		type: 'json',
		default: '{\n  "name": {\n    "$contains": "Acme"\n  }\n}',
		required: true,
		description:
			'An Attio filter object. Supports $and, $or and $not, and filtering through record references with paths. See the <a href="https://docs.attio.com/rest-api/guides/filtering-and-sorting">filtering guide</a>.',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
				filterType: ['json'],
			},
		},
	},
	{
		displayName: 'View ID',
		name: 'viewId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. cf7aaeb5-7507-4a84-9c26-9d36e34d7b70',
		description:
			"UUID of a saved view on this object. Only the view's filter is used; its sorting and visible attributes are not.",
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
				filterType: ['view'],
			},
		},
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Sort Rule',
		default: {},
		description: 'Order of the results. Later rules break ties in earlier ones.',
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Rule',
				name: 'rule',
				values: [
					{
						displayName: 'Attribute Name or ID',
						name: 'attribute',
						type: 'options',
						typeOptions: sortAttributeOptions,
						default: '',
						required: true,
						description:
							'Attribute to sort by. Choose from the list, or specify an attribute slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Field Name or ID',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getQuerySortFields',
							loadOptionsDependsOn: ['&attribute'],
						},
						default: '',
						description:
							'Part of the attribute\'s value to sort by, such as the last name. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Direction',
						name: 'direction',
						type: 'options',
						default: 'asc',
						options: [
							{
								name: 'Ascending',
								value: 'asc',
							},
							{
								name: 'Descending',
								value: 'desc',
							},
						],
					},
				],
			},
		],
	},
];
