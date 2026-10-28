import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGet, attioGetList, isObject } from '../shared/request';
import type { TaskEvent } from './webhooks';

type LinkedRecord = { target_object_id: string; target_record_id: string };

type Assignee = { referenced_actor_type: string; referenced_actor_id: string };

type Actor = { type: string | null; id: string | null };

type TaskResponse = IDataObject & {
	linked_records: LinkedRecord[];
	assignees: Assignee[];
	created_by_actor: Actor;
};

type WorkspaceMember = IDataObject & { id: { workspace_member_id: string } };

function isLinkedRecord(value: unknown): value is LinkedRecord {
	return (
		isObject(value) &&
		typeof value.target_object_id === 'string' &&
		typeof value.target_record_id === 'string'
	);
}

function isAssignee(value: unknown): value is Assignee {
	return (
		isObject(value) &&
		typeof value.referenced_actor_type === 'string' &&
		typeof value.referenced_actor_id === 'string'
	);
}

function isTaskResponse(value: unknown): value is TaskResponse {
	return (
		isObject(value) &&
		Array.isArray(value.linked_records) &&
		value.linked_records.every(isLinkedRecord) &&
		Array.isArray(value.assignees) &&
		value.assignees.every(isAssignee) &&
		isObject(value.created_by_actor)
	);
}

function isWorkspaceMember(value: unknown): value is WorkspaceMember {
	return isObject(value) && isObject(value.id) && typeof value.id.workspace_member_id === 'string';
}

export async function getWorkspaceMembers(
	context: IWebhookFunctions,
): Promise<Map<string, WorkspaceMember>> {
	const members = await attioGetList(context, '/workspace_members', isWorkspaceMember);
	return new Map(members.map((member) => [member.id.workspace_member_id, member]));
}

// A linked record can be deleted after the task links it, so it's left without its record
async function getLinkedRecord(
	context: IWebhookFunctions,
	linkedRecord: LinkedRecord,
): Promise<IDataObject | undefined> {
	const { target_object_id, target_record_id } = linkedRecord;
	try {
		return await attioGet(
			context,
			`/objects/${encodeURIComponent(target_object_id)}/records/${encodeURIComponent(target_record_id)}`,
			(data): data is IDataObject => isObject(data),
			'record',
		);
	} catch (error) {
		if (error instanceof NodeApiError && error.httpCode === '404') return undefined;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

// Adds each linked record's record, and each assignee's and the creator's workspace member,
// alongside their IDs
async function expandTask(
	context: IWebhookFunctions,
	task: TaskResponse,
	members: Map<string, WorkspaceMember>,
): Promise<IDataObject> {
	const getMember = (type: string | null, id: string | null) =>
		type === 'workspace-member' && id !== null ? members.get(id) : undefined;

	const linkedRecords = await Promise.all(
		task.linked_records.map(async (linkedRecord) => ({
			...linkedRecord,
			target_record: await getLinkedRecord(context, linkedRecord),
		})),
	);

	return {
		...task,
		linked_records: linkedRecords,
		assignees: task.assignees.map((assignee) => ({
			...assignee,
			referenced_actor: getMember(assignee.referenced_actor_type, assignee.referenced_actor_id),
		})),
		created_by_actor: {
			...task.created_by_actor,
			workspace_member: getMember(task.created_by_actor.type, task.created_by_actor.id),
		},
	};
}

export async function getTask(
	context: IWebhookFunctions,
	event: TaskEvent,
	members?: Map<string, WorkspaceMember>,
): Promise<IDataObject> {
	const task = await attioGet(
		context,
		`/tasks/${encodeURIComponent(event.id.task_id)}`,
		isTaskResponse,
		'task',
	);

	return members === undefined ? task : await expandTask(context, task, members);
}
