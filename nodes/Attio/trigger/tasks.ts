import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioGet, attioGetList, dataObjectSchema } from '../shared/request';
import type { TaskEvent } from './webhooks';

const linkedRecordSchema = z.object({
	target_object_id: z.string(),
	target_record_id: z.string(),
});

type LinkedRecord = z.infer<typeof linkedRecordSchema>;

const taskSchema = z.object({
	linked_records: z.array(linkedRecordSchema),
	assignees: z.array(
		z.object({
			referenced_actor_type: z.string(),
			referenced_actor_id: z.string(),
		}),
	),
	created_by_actor: z.object({
		type: z.string().nullable(),
		id: z.string().nullable(),
	}),
});

type TaskResponse = z.infer<typeof taskSchema>;

const workspaceMemberSchema = z.object({
	id: z.object({ workspace_member_id: z.string() }),
});

type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export async function getWorkspaceMembers(
	context: IWebhookFunctions,
): Promise<Map<string, WorkspaceMember>> {
	const members = await attioGetList(context, '/workspace_members', workspaceMemberSchema);
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
			dataObjectSchema,
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
		taskSchema,
		'task',
	);

	return members === undefined ? task : await expandTask(context, task, members);
}
