import type { INodeProperties } from 'n8n-workflow';
import { listOptions } from '../../shared/lists';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { offsetPagination, returnAllFields } from '../../shared/pagination';
import { buildQueryBody } from '../../shared/query';
import { queryProperties } from '../../shared/queryProperties';
import { addParentRecords } from './parentRecords';
import { buildListEntryBody, validateEntryId } from './requestBody';

const entriesUrl = '=/lists/{{ encodeURIComponent($parameter.list) }}/entries';

const queryPagination = offsetPagination(500, 'body');

const entryUrl =
	'=/lists/{{ encodeURIComponent($parameter.list) }}/entries/{{ encodeURIComponent($parameter.entryId.trim()) }}';

export const listEntryDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['listEntry'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Add a record to a list',
				action: 'Create a list entry',
				routing: {
					request: {
						method: 'POST',
						url: entriesUrl,
					},
					send: {
						preSend: [buildListEntryBody],
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
				action: 'Create or update a list entry',
				routing: {
					request: {
						method: 'PUT',
						url: entriesUrl,
					},
					send: {
						preSend: [buildListEntryBody],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Remove an entry from a list',
				action: 'Delete a list entry',
				routing: {
					request: {
						method: 'DELETE',
						url: entryUrl,
					},
					send: {
						preSend: [validateEntryId],
					},
					output: {
						postReceive: [deletedResponse],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a list entry',
				action: 'Get a list entry',
				routing: {
					request: {
						method: 'GET',
						url: entryUrl,
					},
					send: {
						preSend: [validateEntryId],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many entries in a list',
				action: 'Get many list entries',
				routing: {
					request: {
						method: 'POST',
						url: `${entriesUrl}/query`,
					},
					send: {
						...queryPagination.send,
						preSend: [buildQueryBody],
					},
					operations: queryPagination.operations,
					output: {
						postReceive: [unwrapResponse, addParentRecords],
					},
				},
			},
		],
		default: 'create',
	},
	{
		displayName: 'List Name or ID',
		name: 'list',
		type: 'options',
		typeOptions: listOptions,
		required: true,
		default: '',
		description:
			'List the entry belongs to. Choose from the list, or specify a list slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['listEntry'],
			},
		},
	},
	{
		displayName: 'Parent Record',
		name: 'parentRecord',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'id', value: '' },
		description:
			'Record to add to the list. "From list" searches all records of the object the list is for, not records already in the list. Create can add a record to the same list more than once. Create or Update updates the record\'s entry if it has one, and fails if it has several.',
		modes: [
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d',
				validation: [
					{
						type: 'regex',
						properties: {
							regex:
								'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
							errorMessage: 'Not a valid record ID',
						},
					},
				],
			},
			{
				// The editor always labels this mode "From list", and only shows the search for a mode named list
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Search all records by name, domain or email...',
				typeOptions: {
					searchListMethod: 'searchListParentRecords',
					searchable: true,
				},
			},
		],
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['create', 'upsert'],
			},
		},
	},
	{
		displayName: 'Entry ID',
		name: 'entryId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 2e6e29ea-c4e0-4f44-842d-78a891f8c156',
		description:
			'ID of the list entry, which is different from the ID of the record it belongs to. Get it from the output of a Create, Create or Update or Get Many list entry step, or an Attio Trigger list entry event, in its <code>entry_id</code> field.',
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['delete', 'get'],
			},
		},
	},
	{
		displayName: 'Entry Attributes',
		name: 'entryValues',
		type: 'resourceMapper',
		noDataExpression: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		description:
			"Values to set on the entry, keyed by the list's attributes. These belong to the entry, not the parent record. Multi-value attributes take an array, and Create or Update replaces their existing values.",
		typeOptions: {
			loadOptionsDependsOn: ['list', 'operation'],
			resourceMapper: {
				resourceMapperMethod: 'getListEntryAttributes',
				mode: 'add',
				fieldWords: {
					singular: 'attribute',
					plural: 'attributes',
				},
				addAllFields: false,
				supportAutoMap: true,
				// Entry values are optional, so an empty list gets a notice rather than an error
				hideNoDataError: true,
			},
		},
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['create', 'upsert'],
			},
			// Otherwise the mapper loads attributes before a list is chosen
			hide: {
				list: [''],
			},
		},
	},
	...returnAllFields('listEntry'),
	{
		displayName: 'Include Parent Record',
		name: 'includeParentRecord',
		type: 'boolean',
		default: true,
		description:
			"Whether to add each entry's parent record, with its attribute values, as <code>parent_record</code>. Fetched with one extra request per object for each page of entries.",
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['getAll'],
			},
		},
	},
	...queryProperties('listEntry'),
];
