import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { z } from 'zod/v4';
import { attributeSchema } from '../resources/record/attributes';
import { getAllActivities } from '../shared/activities';
import { listSchema } from '../shared/lists';
import { attioGetList } from '../shared/request';

const objectSchema = z.object({
	id: z.object({ object_id: z.string() }),
	api_slug: z.string().nullable(),
	plural_noun: z.string().nullable(),
});

function byName(a: INodePropertyOptions, b: INodePropertyOptions): number {
	return a.name.localeCompare(b.name);
}

// Webhook filters match on IDs, so unlike the action node these are keyed by ID rather than slug
export async function getTriggerObjects(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const objects = await attioGetList(this, '/objects', objectSchema);

	return objects
		.map((object) => ({
			name: object.plural_noun ?? object.api_slug ?? object.id.object_id,
			value: object.id.object_id,
		}))
		.sort(byName);
}

export async function getTriggerLists(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const lists = await attioGetList(this, '/lists', listSchema);

	return lists.map((list) => ({ name: list.name, value: list.id.list_id })).sort(byName);
}

export async function getTriggerActivities(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const activities = await getAllActivities(this);

	return activities
		.map((activity) => ({ name: activity.singular_noun, value: activity.id.activity_id }))
		.sort(byName);
}

async function getAttributeOptions(
	context: ILoadOptionsFunctions,
	path: string,
): Promise<INodePropertyOptions[]> {
	const attributes = await attioGetList(context, path, attributeSchema);

	return [
		{ name: 'Any Attribute', value: '' },
		...attributes
			.map((attribute) => ({ name: attribute.title, value: attribute.id.attribute_id }))
			.sort(byName),
	];
}

export async function getTriggerAttributes(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const object = this.getCurrentNodeParameter('object');
	if (typeof object !== 'string' || object === '') return [];

	return await getAttributeOptions(this, `/objects/${encodeURIComponent(object)}/attributes`);
}

export async function getTriggerListAttributes(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const list = this.getCurrentNodeParameter('list');
	if (typeof list !== 'string' || list === '') return [];

	return await getAttributeOptions(this, `/lists/${encodeURIComponent(list)}/attributes`);
}
