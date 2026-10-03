import type { IDataObject, IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { toIsoDate } from '../../shared/dates';

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
