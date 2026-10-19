import type { IDataObject, IWebhookFunctions } from 'n8n-workflow';
import { attioGet, isObject } from '../shared/request';
import type { ActivityRecordEvent } from './webhooks';

export async function getActivityRecord(
	context: IWebhookFunctions,
	event: ActivityRecordEvent,
): Promise<IDataObject> {
	const { activity_id, record_id } = event.id;
	return await attioGet(
		context,
		`/activities/${encodeURIComponent(activity_id)}/records/${encodeURIComponent(record_id)}`,
		(data): data is IDataObject => isObject(data),
		'activity record',
	);
}
