import {
	NodeApiError,
	type IDataObject,
	type IWebhookFunctions,
	type JsonObject,
} from 'n8n-workflow';
import { attioGet, isObject } from '../shared/request';
import type { CallRecordingEvent } from './webhooks';

function isDataObject(data: unknown): data is IDataObject {
	return isObject(data);
}

// A meeting can be deleted after its call is recorded, so the recording is left without it
async function getMeeting(
	context: IWebhookFunctions,
	event: CallRecordingEvent,
): Promise<IDataObject | undefined> {
	try {
		return await attioGet(
			context,
			`/meetings/${encodeURIComponent(event.id.meeting_id)}`,
			isDataObject,
			'meeting',
		);
	} catch (error) {
		if (error instanceof NodeApiError && error.httpCode === '404') return undefined;
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}

// The recording includes its transcript, and its meeting when includeMeeting is set
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
			isDataObject,
			'call recording',
		),
		includeMeeting ? getMeeting(context, event) : undefined,
	]);

	return includeMeeting ? { ...callRecording, meeting } : callRecording;
}
