import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import { toIsoDate } from '../../shared/dates';
import { invalidValueError, isEmail, isUuid } from '../../shared/validation';

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
	return value ? toIsoDate.call(this, value, 'deadline') : null;
}

// Assignees come from the member picker as IDs, or from an expression as IDs or emails
function toAssignees(this: IExecuteSingleFunctions, value: TaskFields['assignees']): IDataObject[] {
	const assignees = typeof value === 'string' ? value.split(',') : (value ?? []);

	return assignees
		.map((assignee) => assignee.trim())
		.filter((assignee) => assignee !== '')
		.map((assignee) => {
			if (isEmail(assignee)) return { workspace_member_email_address: assignee };
			if (isUuid(assignee)) {
				return { referenced_actor_type: 'workspace-member', referenced_actor_id: assignee };
			}

			throw invalidValueError.call(
				this,
				'assignee',
				assignee,
				'Use a workspace member ID or email address',
			);
		});
}

function toLinkedRecords(
	this: IExecuteSingleFunctions,
	value: LinkedRecordsParameter | undefined,
): IDataObject[] {
	return (value?.record ?? []).map(({ object, recordId }) => {
		const id = recordId.trim();
		if (!isUuid(id)) {
			throw invalidValueError.call(
				this,
				'linked record ID',
				id,
				'Use a record ID, for example bf071e1f-6035-429d-b874-d83ea64ea13b',
			);
		}

		return { target_object: object.trim(), target_record_id: id };
	});
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
			linked_records: toLinkedRecords.call(this, fields.linkedRecords),
			assignees: toAssignees.call(this, fields.assignees),
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
	if (fields.linkedRecords !== undefined)
		data.linked_records = toLinkedRecords.call(this, fields.linkedRecords);
	if (fields.assignees !== undefined) data.assignees = toAssignees.call(this, fields.assignees);

	if (Object.keys(data).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No fields to update', {
			description: 'Add at least one field under "Update Fields"',
			itemIndex: this.getItemIndex(),
		});
	}

	requestOptions.body = { data };

	return requestOptions;
}
