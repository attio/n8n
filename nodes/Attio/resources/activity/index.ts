import type { INodeProperties } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { unwrapResponse } from '../../shared/output';
import { buildActivityRecordBody } from './requestBody';

export const activityDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['activity'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Log an activity, such as a phone call',
				action: 'Create an activity',
				routing: {
					request: {
						method: 'POST',
						url: '=/activities/{{ encodeURIComponent($parameter.activity) }}/records',
					},
					send: {
						preSend: [buildActivityRecordBody],
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
		displayName: 'Activity Name or ID',
		name: 'activity',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getActivities',
		},
		required: true,
		default: '',
		description:
			'The kind of activity to log, such as Phone call. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['activity'],
			},
		},
	},
	{
		displayName: 'Linked Records',
		name: 'linkedRecordsType',
		type: 'options',
		noDataExpression: true,
		default: 'define',
		description:
			"Records the activity is logged against, such as a company and a deal. It shows on each record's activity timeline.",
		options: [
			{
				name: 'Add Records',
				value: 'define',
				description: 'Choose each record, or match it by email address or domain',
			},
			{
				name: 'JSON',
				value: 'json',
				description:
					'Use an array of Attio record references, for example to link a different number of records from input data',
			},
		],
		displayOptions: {
			show: {
				resource: ['activity'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Records',
		name: 'activityLinkedRecords',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		required: true,
		placeholder: 'Add Linked Record',
		default: {},
		displayOptions: {
			show: {
				resource: ['activity'],
				operation: ['create'],
				linkedRecordsType: ['define'],
			},
		},
		options: [
			{
				displayName: 'Record',
				name: 'record',
				values: [
					{
						displayName: 'Object Name or ID',
						name: 'object',
						type: 'options',
						typeOptions: objectOptions,
						required: true,
						default: '',
						description:
							'Object the record belongs to. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Record',
						name: 'record',
						type: 'resourceLocator',
						required: true,
						default: { mode: 'list', value: '' },
						modes: [
							{
								// The editor always labels this mode "From list", and only shows the search for a mode named list
								displayName: 'From List',
								name: 'list',
								type: 'list',
								placeholder: 'Search by name, domain or email...',
								typeOptions: {
									searchListMethod: 'searchLinkedRecords',
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
							{
								displayName: 'By Email or Domain',
								name: 'match',
								type: 'string',
								placeholder: 'e.g. jane@example.com or example.com',
								hint: 'An email address for People, or a domain for Companies. It must match exactly one record.',
							},
						],
					},
				],
			},
		],
	},
	{
		displayName:
			"The node logs one activity for each input item. To log one activity linked to the records from every input item, turn on 'Execute Once' in the node's settings.",
		name: 'executeOnceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['activity'],
				operation: ['create'],
				linkedRecordsType: ['json'],
			},
		},
	},
	{
		displayName: 'Linked Records (JSON)',
		name: 'linkedRecordsJson',
		type: 'json',
		required: true,
		default: '[\n  "jane@example.com",\n  "example.com"\n]',
		description:
			'An array of record references. An email address links the person with it, and a domain links the company. To link a record of any object by ID, use the <a href="https://docs.attio.com/rest-api/guides/activities#linking-records-by-attribute-value">target_object syntax</a>.',
		hint: 'To link the records from every input item, use an expression like <code>{{ $input.all().flatMap(item => item.json.values.email_addresses.map(email => email.email_address)) }}</code>',
		displayOptions: {
			show: {
				resource: ['activity'],
				operation: ['create'],
				linkedRecordsType: ['json'],
			},
		},
	},
	{
		displayName: 'Attributes',
		name: 'activityValues',
		type: 'resourceMapper',
		noDataExpression: true,
		required: true,
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		description:
			'Values to set, keyed by attribute. Multi-value attributes take an array. Record references, such as participants, take email addresses, phone numbers or domains separated by commas, like jane@example.com, example.com, which Attio matches to people and companies.',
		typeOptions: {
			loadOptionsDependsOn: ['activity'],
			resourceMapper: {
				resourceMapperMethod: 'getActivityAttributes',
				mode: 'add',
				fieldWords: {
					singular: 'attribute',
					plural: 'attributes',
				},
				// Activities have few attributes, so all of them are shown rather than only the required ones
				addAllFields: true,
				supportAutoMap: true,
				noFieldsError: 'This activity has no writable attributes',
			},
		},
		displayOptions: {
			show: {
				resource: ['activity'],
				operation: ['create'],
			},
			// Otherwise the mapper reports the activity as having no writable attributes
			hide: {
				activity: [''],
			},
		},
	},
];
