import type { INodeProperties } from 'n8n-workflow';
import { buildCreateTaskBody, buildUpdateTaskBody } from './requestBody';

const showOnlyForTasks = {
	resource: ['task'],
};

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

const assigneesField: INodeProperties = {
	displayName: 'Assignee Names or IDs',
	name: 'assignees',
	type: 'multiOptions',
	typeOptions: {
		loadOptions: {
			routing: {
				request: {
					method: 'GET',
					url: '/workspace_members',
				},
				output: {
					postReceive: [
						{
							type: 'rootProperty',
							properties: {
								property: 'data',
							},
						},
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
	},
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
					displayName: 'Object',
					name: 'object',
					type: 'string',
					default: '',
					required: true,
					placeholder: 'e.g. companies',
					description: 'Slug or ID of the object the record belongs to',
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
			show: showOnlyForTasks,
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
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
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
						postReceive: [{ type: 'rootProperty', properties: { property: 'data' } }],
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
				...showOnlyForTasks,
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
				...showOnlyForTasks,
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
		description: 'ID of the task to update',
		displayOptions: {
			show: {
				...showOnlyForTasks,
				operation: ['update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'Only the deadline, completion status, assignees and linked records can be updated',
		displayOptions: {
			show: {
				...showOnlyForTasks,
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
