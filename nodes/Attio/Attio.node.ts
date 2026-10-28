import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { activityDescription } from './resources/activity';
import {
	getActivities,
	getActivityAttributes,
	searchLinkedRecords,
} from './resources/activity/loadOptions';
import { listEntryDescription } from './resources/listEntry';
import { getListEntryAttributes, searchListParentRecords } from './resources/listEntry/loadOptions';
import { noteDescription } from './resources/note';
import { recordDescription } from './resources/record';
import { getRecordAttributes } from './resources/record/attributes';
import {
	getQueryAttributes,
	getQueryFilterFields,
	getQuerySortAttributes,
	getQuerySortFields,
} from './shared/query';
import { taskDescription } from './resources/task';
import { attioBaseUrl } from './shared/request';

export class Attio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Attio',
		name: 'attio',
		icon: { light: 'file:../../icons/attio.svg', dark: 'file:../../icons/attio.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Attio API',
		defaults: {
			name: 'Attio',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'attioApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: attioBaseUrl,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Activity',
						value: 'activity',
					},
					{
						name: 'List Entry',
						value: 'listEntry',
					},
					{
						name: 'Note',
						value: 'note',
					},
					{
						name: 'Record',
						value: 'record',
					},
					{
						name: 'Task',
						value: 'task',
					},
				],
				default: 'task',
			},
			...activityDescription,
			...listEntryDescription,
			...noteDescription,
			...recordDescription,
			...taskDescription,
		],
	};

	methods = {
		loadOptions: {
			getActivities,
			getQueryAttributes,
			getQueryFilterFields,
			getQuerySortAttributes,
			getQuerySortFields,
		},
		listSearch: {
			searchLinkedRecords,
			searchListParentRecords,
		},
		resourceMapping: {
			getActivityAttributes,
			getListEntryAttributes,
			getRecordAttributes,
		},
	};
}
