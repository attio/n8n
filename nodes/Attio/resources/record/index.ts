import type { INodeProperties, ResourceMapperTypeOptions } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { buildRecordUpsertRequest, buildRecordValuesBody } from './attributes';

const recordsUrl = '=/objects/{{ encodeURIComponent($parameter.object) }}/records';

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
				description:
					'Create a new record, or update the current one if it already exists (upsert)',
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
];
