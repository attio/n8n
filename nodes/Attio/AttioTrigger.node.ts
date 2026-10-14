import {
	NodeConnectionTypes,
	NodeOperationError,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { getTriggerAttributes, getTriggerObjects } from './trigger/loadOptions';
import { getRecord } from './trigger/records';
import { getTask, getWorkspaceMembers } from './trigger/tasks';
import {
	createWebhook,
	deleteWebhook,
	getRecordEvents,
	getTaskEvents,
	getWebhook,
	hasValidSignature,
	type EventType,
	type RecordEvent,
	type RecordEventType,
	type WebhookFilter,
} from './trigger/webhooks';

type WebhookStaticData = {
	webhookId?: string;
	webhookSecret?: string;
};

function getWebhookUrl(context: IHookFunctions): string {
	const url = context.getNodeWebhookUrl('default');
	if (url === undefined) {
		throw new NodeOperationError(context.getNode(), 'No webhook URL is available for this trigger');
	}
	return url;
}

// Attio rejects target URLs that aren't HTTPS with a generic validation error
function assertHttps(context: IHookFunctions, url: string): void {
	if (url.startsWith('https://')) return;

	throw new NodeOperationError(context.getNode(), 'Attio only sends webhooks to HTTPS URLs', {
		description: `This trigger's webhook URL is ${url}. Make n8n reachable over HTTPS, such as through a tunnel, and set the WEBHOOK_URL environment variable to its public address.`,
	});
}

function getEventType(context: IHookFunctions | IWebhookFunctions): EventType {
	return context.getNodeParameter('event') as EventType;
}

function getAttribute(context: IHookFunctions | IWebhookFunctions, eventType: EventType) {
	if (eventType !== 'record.updated') return '';
	return context.getNodeParameter('attribute', '') as string;
}

// Task events aren't filtered, so only record events have a filter
function getFilter(context: IHookFunctions, eventType: EventType): WebhookFilter | null {
	if (eventType === 'task.created') return null;

	const object = context.getNodeParameter('object') as string;
	const attribute = getAttribute(context, eventType);

	return {
		$and: [
			{ field: 'id.object_id', operator: 'equals', value: object },
			...(attribute !== ''
				? [{ field: 'id.attribute_id', operator: 'equals' as const, value: attribute }]
				: []),
		],
	};
}

function matchesFilter(
	context: IWebhookFunctions,
	eventType: RecordEventType,
	event: RecordEvent,
): boolean {
	const object = context.getNodeParameter('object') as string;
	const attribute = getAttribute(context, eventType);

	// The webhook's filter already limits events to this object and attribute, but test events
	// sent from Attio's developer settings skip the filter, so they're checked again here. Each
	// webhook subscribes to a single event type, so that doesn't need checking
	return event.id.object_id === object && (attribute === '' || event.id.attribute_id === attribute);
}

export class AttioTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Attio Trigger',
		name: 'attioTrigger',
		icon: { light: 'file:../../icons/attio.svg', dark: 'file:../../icons/attio.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when Attio events occur',
		defaults: {
			name: 'Attio Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'attioApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				required: true,
				options: [
					{
						name: 'Record Created',
						value: 'record.created',
						description: 'Triggers when a record, such as a person, company or deal, is created',
					},
					{
						name: 'Record Deleted',
						value: 'record.deleted',
						description: 'Triggers when a record, such as a person, company or deal, is deleted',
					},
					{
						name: 'Record Updated',
						value: 'record.updated',
						description:
							'Triggers when values on a record, such as a person, company or deal, are updated',
					},
					{
						name: 'Task Created',
						value: 'task.created',
						description: 'Triggers when a task is created',
					},
				],
				default: 'record.created',
			},
			{
				displayName: 'Object Name or ID',
				name: 'object',
				type: 'options',
				required: true,
				default: '',
				description:
					'The object to watch for record events, such as People or Companies. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getTriggerObjects',
				},
				displayOptions: {
					show: {
						event: ['record.created', 'record.deleted', 'record.updated'],
					},
				},
			},
			{
				displayName: 'Attribute Name or ID',
				name: 'attribute',
				type: 'options',
				default: '',
				description:
					'Only trigger when this attribute is updated. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: {
					loadOptionsMethod: 'getTriggerAttributes',
					loadOptionsDependsOn: ['object'],
				},
				displayOptions: {
					show: {
						event: ['record.updated'],
					},
					hide: {
						object: [''],
					},
				},
			},
			{
				displayName: 'Include List Entries',
				name: 'includeListEntries',
				type: 'boolean',
				default: false,
				description:
					"Whether to add the record's entries across all lists, with each entry's list and ID but not its values. Costs an extra request per record.",
				displayOptions: {
					show: {
						event: ['record.created', 'record.updated'],
					},
				},
			},
			{
				displayName: 'Include Linked Records and Members',
				name: 'includeLinkedRecordsAndMembers',
				type: 'boolean',
				default: false,
				description:
					"Whether to add each linked record's record, and the workspace members who are assigned to or created the task. Costs an extra request per linked record, and one for the members.",
				displayOptions: {
					show: {
						event: ['task.created'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			getTriggerAttributes,
			getTriggerObjects,
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				if (staticData.webhookId === undefined) return false;

				const webhook = await getWebhook(this, staticData.webhookId);
				// Attio stops delivering to inactive webhooks. create() replaces them
				if (
					webhook === undefined ||
					webhook.status === 'inactive' ||
					webhook.target_url !== getWebhookUrl(this)
				) {
					delete staticData.webhookId;
					delete staticData.webhookSecret;
					return false;
				}

				return true;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const eventType = getEventType(this);
				const filter = getFilter(this, eventType);

				const webhookUrl = getWebhookUrl(this);
				assertHttps(this, webhookUrl);

				const webhook = await createWebhook(this, webhookUrl, eventType, filter);

				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				staticData.webhookId = webhook.id.webhook_id;
				staticData.webhookSecret = webhook.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as WebhookStaticData;
				if (staticData.webhookId !== undefined) {
					await deleteWebhook(this, staticData.webhookId);
				}

				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const { webhookSecret } = this.getWorkflowStaticData('node') as WebhookStaticData;
		if (webhookSecret === undefined || !hasValidSignature(this, webhookSecret)) {
			this.getResponseObject().status(401).send('Unauthorized').end();
			return { noWebhookResponse: true };
		}

		const eventType = getEventType(this);

		if (eventType === 'task.created') {
			const events = getTaskEvents(this);
			if (events.length === 0) return {};

			const expand = this.getNodeParameter('includeLinkedRecordsAndMembers', false) as boolean;
			// Members are fetched once for every task in the delivery
			const members = expand ? await getWorkspaceMembers(this) : undefined;
			const tasks = await Promise.all(
				events.map(async (event) => await getTask(this, event, members)),
			);
			return { workflowData: [this.helpers.returnJsonArray(tasks)] };
		}

		const events = getRecordEvents(this).filter((event) => matchesFilter(this, eventType, event));

		if (eventType === 'record.deleted') {
			if (events.length === 0) return {};
			return { workflowData: [this.helpers.returnJsonArray(events)] };
		}

		// Updating several attributes at once sends an event for each, so each record is fetched once
		const recordEvents = [...new Map(events.map((event) => [event.id.record_id, event])).values()];
		if (recordEvents.length === 0) return {};

		const includeListEntries = this.getNodeParameter('includeListEntries', false) as boolean;
		const records = await Promise.all(
			recordEvents.map(async (event) => await getRecord(this, event, includeListEntries)),
		);
		return { workflowData: [this.helpers.returnJsonArray(records)] };
	}
}
