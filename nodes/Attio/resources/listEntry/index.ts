import type { INodeProperties } from 'n8n-workflow';
import { listOptions } from '../../shared/lists';
import { unwrapResponse } from '../../shared/output';
import { buildCreateListEntryBody, validateEntryId } from './requestBody';

const entriesUrl = '=/lists/{{ encodeURIComponent($parameter.list) }}/entries';

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
						preSend: [buildCreateListEntryBody],
					},
					output: {
						postReceive: [unwrapResponse],
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
		default: { mode: 'list', value: '' },
		description:
			'Record to add to the list, from the object the list is for. A record can be added to the same list more than once.',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a record...',
				typeOptions: {
					searchListMethod: 'searchListParentRecords',
					searchable: true,
				},
			},
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
		],
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['create'],
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
		displayOptions: {
			show: {
				resource: ['listEntry'],
				operation: ['get'],
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
			"Values to set on the entry, keyed by the list's attributes. These belong to the entry, not the parent record. Multi-value attributes take an array.",
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
				operation: ['create'],
			},
			// Otherwise the mapper loads attributes before a list is chosen
			hide: {
				list: [''],
			},
		},
	},
];
