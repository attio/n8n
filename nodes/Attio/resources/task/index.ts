import type { INodeProperties, INodePropertyTypeOptions } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { offsetPagination, returnAllFields } from '../../shared/pagination';
import { buildCreateTaskBody, buildUpdateTaskBody } from './requestBody';

const deadlineField: INodeProperties = {
	displayName: 'Deadline',
	name: 'deadlineAt',
	type: 'dateTime',
	default: '',
	description: 'When the task is due',
};

const isCompletedField: INodeProperties = {
	displayName: 'Is Completed',
	name: 'isCompleted',
	type: 'boolean',
	default: false,
	description: 'Whether the task has been completed',
};

const memberOptions: INodePropertyTypeOptions = {
	loadOptions: {
		routing: {
			request: {
				method: 'GET',
				url: '/workspace_members',
			},
			output: {
				postReceive: [
					unwrapResponse,
					{
						type: 'setKeyValue',
						properties: {
							name: '={{ [$responseItem.first_name, $responseItem.last_name].join(" ").trim() || $responseItem.email_address }}',
							value: '={{ $responseItem.id.workspace_member_id }}',
							description: '={{ $responseItem.email_address }}',
						},
					},
					{
						type: 'sort',
						properties: {
							key: 'name',
						},
					},
				],
			},
		},
	},
};

const assigneesField: INodeProperties = {
	displayName: 'Assignee Names or IDs',
	name: 'assignees',
	type: 'multiOptions',
	typeOptions: memberOptions,
	default: [],
	description:
		'Workspace members assigned to the task. Choose from the list, or specify member IDs or email addresses using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

const linkedRecordsField: INodeProperties = {
	displayName: 'Linked Records',
	name: 'linkedRecords',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
	},
	placeholder: 'Add Linked Record',
	default: {},
	description: 'Records the task is about',
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
					default: '',
					required: true,
					description:
						'Object the record belongs to. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				},
				{
					displayName: 'Record ID',
					name: 'recordId',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. bf071e1f-6035-429d-b874-d83ea64ea13b',
				},
			],
		},
	],
};

export const taskDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['task'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a task',
				action: 'Create a task',
				routing: {
					request: {
						method: 'POST',
						url: '/tasks',
					},
					send: {
						preSend: [buildCreateTaskBody],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a task',
				action: 'Delete a task',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/tasks/{{ encodeURIComponent($parameter.taskId) }}',
					},
					output: {
						postReceive: [deletedResponse],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a task',
				action: 'Get a task',
				routing: {
					request: {
						method: 'GET',
						url: '=/tasks/{{ encodeURIComponent($parameter.taskId) }}',
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many tasks',
				action: 'Get many tasks',
				routing: {
					request: {
						method: 'GET',
						url: '/tasks',
					},
					...offsetPagination(500),
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a task',
				action: 'Update a task',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/tasks/{{ encodeURIComponent($parameter.taskId) }}',
					},
					send: {
						preSend: [buildUpdateTaskBody],
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
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		required: true,
		default: '',
		description: 'Plain text content of the task, up to 2,000 characters',
		displayOptions: {
			show: {
				resource: ['task'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['task'],
				operation: ['create'],
			},
		},
		options: [assigneesField, deadlineField, isCompletedField, linkedRecordsField],
	},
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 649e34f4-c39a-4f4d-99ef-48a36bef8f04',
		displayOptions: {
			show: {
				resource: ['task'],
				operation: ['delete', 'get', 'update'],
			},
		},
	},
	...returnAllFields('task'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['task'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Assignee Name or ID',
				name: 'assignee',
				type: 'options',
				typeOptions: memberOptions,
				default: '',
				description:
					'Only return tasks assigned to this workspace member. Choose from the list, or specify a member ID or email address using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: {
					send: {
						type: 'query',
						property: 'assignee',
					},
				},
			},
			{
				...isCompletedField,
				description: 'Whether to only return completed tasks, or only incomplete ones',
				routing: {
					send: {
						type: 'query',
						property: 'is_completed',
					},
				},
			},
			{
				displayName: 'Linked Object Name or ID',
				name: 'linkedObject',
				type: 'options',
				typeOptions: objectOptions,
				default: '',
				description:
					'Object of the linked record. Use together with Linked Record ID. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: {
					send: {
						type: 'query',
						property: 'linked_object',
					},
				},
			},
			{
				displayName: 'Linked Record ID',
				name: 'linkedRecordId',
				type: 'string',
				default: '',
				placeholder: 'e.g. bf071e1f-6035-429d-b874-d83ea64ea13b',
				description: 'Only return tasks linked to this record. Use together with Linked Object.',
				routing: {
					send: {
						type: 'query',
						property: 'linked_record_id',
					},
				},
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{
						name: 'Completed (Newest First)',
						value: 'completed_at:desc',
					},
					{
						name: 'Completed (Oldest First)',
						value: 'completed_at:asc',
					},
					{
						name: 'Created (Newest First)',
						value: 'created_at:desc',
					},
					{
						name: 'Created (Oldest First)',
						value: 'created_at:asc',
					},
				],
				default: 'created_at:asc',
				description: 'Order of the results',
				routing: {
					send: {
						type: 'query',
						property: 'sort',
					},
				},
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the deadline, completion status, assignees and linked records can be updated',
		displayOptions: {
			show: {
				resource: ['task'],
				operation: ['update'],
			},
		},
		options: [
			{
				...assigneesField,
				description: `${assigneesField.description} Replaces the current assignees.`,
			},
			{
				...deadlineField,
				description: 'When the task is due. Leave empty to clear the deadline.',
			},
			isCompletedField,
			{
				...linkedRecordsField,
				description: 'Records the task is about. Replaces the current linked records.',
			},
		],
	},
];
