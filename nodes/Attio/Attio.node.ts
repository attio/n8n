import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { noteDescription } from './resources/note';
import { taskDescription } from './resources/task';

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
			baseURL: 'https://api.attio.com/v2',
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
						name: 'Note',
						value: 'note',
					},
					{
						name: 'Task',
						value: 'task',
					},
				],
				default: 'task',
			},
			...noteDescription,
			...taskDescription,
		],
	};
}
