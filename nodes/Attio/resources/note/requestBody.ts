import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
} from 'n8n-workflow';
import { toIsoDate } from '../../shared/dates';

type NoteUpdateFields = {
	title?: string;
	content?: string;
	format?: 'plaintext' | 'markdown';
};

type NoteFields = {
	format?: 'plaintext' | 'markdown';
	createdAt?: string;
	meetingId?: string;
};

export async function buildCreateNoteBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const fields = this.getNodeParameter('additionalFields', {}) as NoteFields;

	const data: IDataObject = {
		parent_object: this.getNodeParameter('parentObject') as string,
		parent_record_id: (this.getNodeParameter('parentRecordId') as string).trim(),
		title: this.getNodeParameter('title') as string,
		content: this.getNodeParameter('content') as string,
		format: fields.format ?? 'plaintext',
	};

	if (fields.createdAt) data.created_at = toIsoDate.call(this, fields.createdAt, 'created at date');
	if (fields.meetingId?.trim()) data.meeting_id = fields.meetingId.trim();

	requestOptions.body = { data };

	return requestOptions;
}

export async function buildUpdateNoteBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const fields = this.getNodeParameter('updateFields', {}) as NoteUpdateFields;
	const data: IDataObject = {};

	if (fields.title !== undefined) data.title = fields.title;
	// Format describes the content, so it is only sent alongside it
	if (fields.content !== undefined) {
		data.content = fields.content;
		data.format = fields.format ?? 'plaintext';
	}

	if (Object.keys(data).length === 0) {
		throw new NodeOperationError(this.getNode(), 'No fields to update', {
			description: 'Add a title or content under "Update Fields"',
			itemIndex: this.getItemIndex(),
		});
	}

	requestOptions.body = { data };

	return requestOptions;
}
