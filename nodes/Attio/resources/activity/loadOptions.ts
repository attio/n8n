import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	INodePropertyOptions,
	ResourceMapperFields,
} from 'n8n-workflow';
import { getAllActivities } from '../../shared/activities';
import { searchObjectRecords } from '../../shared/recordSearch';
import { getAttributeFields } from '../record/attributes';

// Keyed by slug, like objects and lists in the action node
export async function getActivities(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const activities = await getAllActivities(this);

	return activities
		.map((activity) => ({ name: activity.singular_noun, value: activity.api_slug }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActivityAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const activity = this.getNodeParameter('activity', '') as string;
	if (!activity) {
		return { fields: [], emptyFieldsNotice: 'Choose an activity to see its attributes' };
	}

	return await getAttributeFields.call(
		this,
		`/activities/${encodeURIComponent(activity)}/attributes`,
		// Every activity has linked records, which get their own parameter
		{ excludedSlugs: ['linked_records'], referencesAsText: true },
	);
}

// Searches the records of the object chosen in the same Linked Records row
export async function searchLinkedRecords(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const object = this.getCurrentNodeParameter('&object') as string | undefined;
	if (!object) return { results: [] };

	return await searchObjectRecords(this, object, filter);
}
