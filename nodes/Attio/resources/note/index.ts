import type { INodeProperties } from 'n8n-workflow';
import { objectOptions } from '../../shared/objects';
import { unwrapResponse } from '../../shared/output';
import { buildCreateNoteBody } from './requestBody';

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
			{
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
			},
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
];
