import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';

type LinkedRecordsParameter = {
	record?: Array<{ object: string; recordId: string }>;
};

type TaskFields = {
	deadlineAt?: string;
	isCompleted?: boolean;
	assignees?: string[] | string;
	linkedRecords?: LinkedRecordsParameter;
};

function toDeadline(this: IExecuteSingleFunctions, value: string | undefined): string | null {
	if (!value) return null;

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new NodeOperationError(this.getNode(), `Invalid deadline "${value}"`, {
			description: 'Use an ISO 8601 date, for example 2026-10-03T15:00:00Z',
			itemIndex: this.getItemIndex(),
		});
	}

	return date.toISOString();
}

// Assignees come from the member picker as IDs, or from an expression as IDs or emails
function toAssignees(value: TaskFields['assignees']): IDataObject[] {
	const assignees = typeof value === 'string' ? value.split(',') : (value ?? []);

	return assignees
		.map((assignee) => assignee.trim())
		.filter((assignee) => assignee !== '')
		.map((assignee) =>
			assignee.includes('@')
				? { workspace_member_email_address: assignee }
				: { referenced_actor_type: 'workspace-member', referenced_actor_id: assignee },
		);
}

function toLinkedRecords(value: LinkedRecordsParameter | undefined): IDataObject[] {
	return (value?.record ?? []).map(({ object, recordId }) => ({
		target_object: object.trim(),
		target_record_id: recordId.trim(),
	}));
}

export async function buildCreateTaskBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const content = this.getNodeParameter('content') as string;
	const fields = this.getNodeParameter('additionalFields', {}) as TaskFields;

	// The API requires every field on create, so fill in empty defaults
	requestOptions.body = {
		data: {
			content,
			format: 'plaintext',
			deadline_at: toDeadline.call(this, fields.deadlineAt),
			is_completed: fields.isCompleted ?? false,
			linked_records: toLinkedRecords(fields.linkedRecords),
			assignees: toAssignees(fields.assignees),
		},
	};

	return requestOptions;
}

export async function buildUpdateTaskBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const fields = this.getNodeParameter('updateFields', {}) as TaskFields;
	const data: IDataObject = {};

	if (fields.deadlineAt !== undefined) data.deadline_at = toDeadline.call(this, fields.deadlineAt);
	if (fields.isCompleted !== undefined) data.is_completed = fields.isCompleted;
	if (fields.linkedRecords !== undefined) data.linked_records = toLinkedRecords(fields.linkedRecords);
	if (fields.assignees !== undefined) data.assignees = toAssignees(fields.assignees);

	if (Object.keys(data).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No fields to update', {
			description: 'Add at least one field under "Update Fields"',
			itemIndex: this.getItemIndex(),
		});
	}

	requestOptions.body = { data };

	return requestOptions;
}
