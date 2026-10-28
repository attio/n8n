import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGet, dataObjectSchema } from '../shared/request';
import type { CallRecordingEvent } from './webhooks';

// A meeting can be deleted after its call is recorded, so the recording is left without it
async function getMeeting(
	context: IWebhookFunctions,
	event: CallRecordingEvent,
): Promise<IDataObject | undefined> {
	try {
		return await attioGet(
			context,
			`/meetings/${encodeURIComponent(event.id.meeting_id)}`,
			dataObjectSchema,
			'meeting',
		);
	} catch (error) {
		if (error instanceof NodeApiError && error.httpCode === '404') return undefined;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

// The transcript is part of the recording. The meeting is a separate request for the calendar
// event it was recorded in, with its title, times and participants
export async function getCallRecording(
	context: IWebhookFunctions,
	event: CallRecordingEvent,
	includeMeeting: boolean,
): Promise<IDataObject> {
	const { meeting_id, call_recording_id } = event.id;
	const [callRecording, meeting] = await Promise.all([
		attioGet(
			context,
			`/meetings/${encodeURIComponent(meeting_id)}/call_recordings/${encodeURIComponent(call_recording_id)}`,
			dataObjectSchema,
			'call recording',
		),
		includeMeeting ? getMeeting(context, event) : undefined,
	]);

	return includeMeeting ? { ...callRecording, meeting } : callRecording;
}
