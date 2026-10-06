import type { INodeProperties } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { buildRecordValuesBody } from './attributes';

const recordUrl =
	'=/objects/{{ encodeURIComponent($parameter.object) }}/records/{{ encodeURIComponent($parameter.recordId) }}';

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
						url: '=/objects/{{ encodeURIComponent($parameter.object) }}/records',
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
				operation: ['delete', 'get'],
			},
		},
	},
	{
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
			loadOptionsDependsOn: ['object'],
			resourceMapper: {
				resourceMapperMethod: 'getRecordAttributes',
				mode: 'add',
				fieldWords: {
					singular: 'attribute',
					plural: 'attributes',
				},
				addAllFields: false,
				supportAutoMap: true,
				noFieldsError: 'This object has no writable attributes',
			},
		},
		displayOptions: {
			show: {
				resource: ['record'],
				operation: ['create'],
			},
			// Otherwise the mapper reports the object as having no writable attributes
			hide: {
				object: [''],
			},
		},
	},
];
