import type { IDataObject, IWebhookFunctions } from 'n8n-workflow';
import { attioGet, dataObjectSchema } from '../shared/request';
import type { ActivityRecordEvent } from './webhooks';

export async function getActivityRecord(
	context: IWebhookFunctions,
	event: ActivityRecordEvent,
): Promise<IDataObject> {
	const { activity_id, record_id } = event.id;
	return await attioGet(
		context,
		`/activities/${encodeURIComponent(activity_id)}/records/${encodeURIComponent(record_id)}`,
		dataObjectSchema,
		'activity record',
	);
}
