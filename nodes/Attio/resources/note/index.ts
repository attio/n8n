import type { INodeProperties } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { deletedResponse, unwrapResponse } from '../../shared/output';
import { offsetPagination, returnAllFields } from '../../shared/pagination';
import { buildCreateNoteBody, buildUpdateNoteBody } from './requestBody';

const formatField: INodeProperties = {
	displayName: 'Format',
	name: 'format',
	type: 'options',
	options: [
		{
			name: 'Plain Text',
			value: 'plaintext',
			description: 'Line breaks are kept as-is',
		},
		{
			name: 'Markdown',
			value: 'markdown',
			description:
				'Supports headings (levels 1-3), lists, bold, italic, strikethrough, ==highlight== and links',
		},
	],
	default: 'plaintext',
	description: 'How the content is formatted',
};

export const noteDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['note'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a note',
				action: 'Create a note',
				routing: {
					request: {
						method: 'POST',
						url: '/notes',
					},
					send: {
						preSend: [buildCreateNoteBody],
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a note',
				action: 'Delete a note',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/notes/{{ encodeURIComponent($parameter.noteId) }}',
					},
					output: {
						postReceive: [deletedResponse],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a note',
				action: 'Get a note',
				routing: {
					request: {
						method: 'GET',
						url: '=/notes/{{ encodeURIComponent($parameter.noteId) }}',
					},
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many notes',
				action: 'Get many notes',
				routing: {
					request: {
						method: 'GET',
						url: '/notes',
					},
					...offsetPagination(50),
					output: {
						postReceive: [unwrapResponse],
					},
				},
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a note',
				action: 'Update a note',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/notes/{{ encodeURIComponent($parameter.noteId) }}',
					},
					send: {
						preSend: [buildUpdateNoteBody],
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
		displayName: 'Parent Object Name or ID',
		name: 'parentObject',
		type: 'options',
		typeOptions: objectOptions,
		required: true,
		default: '',
		description:
			'Object of the record the note belongs to. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Parent Record ID',
		name: 'parentRecordId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d',
		description: 'ID of the record the note belongs to',
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		description: 'Plain text title of the note',
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['create'],
			},
		},
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
		description: 'Content of the note, in the chosen format',
		displayOptions: {
			show: {
				resource: ['note'],
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
				resource: ['note'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Created At',
				name: 'createdAt',
				type: 'dateTime',
				default: '',
				description:
					'Backdate the note, for example when migrating. Defaults to now. Cannot be in the future or before 1970.',
			},
			formatField,
			{
				displayName: 'Meeting ID',
				name: 'meetingId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 14beef7a-99f7-4534-a87e-70b564330a4c',
				description: 'ID of an existing meeting to associate the note with',
			},
		],
	},
	{
		displayName: 'Note ID',
		name: 'noteId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. ff3f3bd4-40f4-4f80-8187-cd02385af424',
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['delete', 'get', 'update'],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			"Only the title and content can be updated. A note can't be moved to another record.",
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description:
					'Content of the note, in the chosen format. Replaces the entire current content.',
			},
			{
				...formatField,
				description: 'How the new content is formatted. Only used when Content is set.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'Plain text title of the note',
			},
		],
	},
	...returnAllFields('note'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		description: 'Set both to only return notes on a specific record',
		displayOptions: {
			show: {
				resource: ['note'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Parent Object Name or ID',
				name: 'parentObject',
				type: 'options',
				typeOptions: objectOptions,
				default: '',
				description:
					'Object of the record the notes belong to. Choose from the list, or specify an object slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: {
					send: {
						type: 'query',
						property: 'parent_object',
					},
				},
			},
			{
				displayName: 'Parent Record ID',
				name: 'parentRecordId',
				type: 'string',
				default: '',
				placeholder: 'e.g. 891dcbfc-9141-415d-9b2a-2238a6cc012d',
				description: 'ID of the record the notes belong to',
				routing: {
					send: {
						type: 'query',
						property: 'parent_record_id',
					},
				},
			},
		],
	},
];
