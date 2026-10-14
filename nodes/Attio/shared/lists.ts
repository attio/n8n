import {
	NodeOperationError,
	type IExecuteSingleFunctions,
	type ILoadOptionsFunctions,
	type INodePropertyTypeOptions,
} from 'n8n-workflow';
import { unwrapResponse } from './output';
import { attioGet, isObject } from './request';

export type ListResponse = {
	id: { list_id: string };
	api_slug: string | null;
	name: string;
	// Legacy lists can allow records from more than one object
	parent_object: string[];
};

export function isListResponse(value: unknown): value is ListResponse {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.list_id === 'string' &&
		(typeof value.api_slug === 'string' || value.api_slug === null) &&
		typeof value.name === 'string' &&
		Array.isArray(value.parent_object) &&
		value.parent_object.every((object) => typeof object === 'string')
	);
}

// Lists the workspace's lists, keyed by slug, falling back to ID for lists without one
export const listOptions: INodePropertyTypeOptions = {
	loadOptions: {
		routing: {
			request: {
				method: 'GET',
				url: '/lists',
			},
			output: {
				postReceive: [
					unwrapResponse,
					{
						type: 'setKeyValue',
						properties: {
							name: '={{ $responseItem.name }}',
							value: '={{ $responseItem.api_slug ?? $responseItem.id.list_id }}',
						},
					},
					{
						type: 'sort',
						properties: {
							key: 'name',
						},
					},
				],
			},
		},
	},
};

// The object a list's records come from. Attio only creates lists with one, but legacy lists can
// accept records from several, and the node can't tell which object a record belongs to
export async function getListParentObject(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	list: string,
): Promise<string> {
	const { name, parent_object: parentObjects } = await attioGet(
		context,
		`/lists/${encodeURIComponent(list)}`,
		isListResponse,
		'list',
	);

	if (parentObjects.length !== 1) {
		throw new NodeOperationError(
			context.getNode(),
			`The list "${name}" isn't supported, as it accepts records from ${parentObjects.length === 0 ? 'no objects' : 'more than one object'}`,
			{
				description:
					parentObjects.length === 0
						? 'Check the list in Attio, or choose a different list'
						: `This is a legacy list that accepts ${parentObjects.join(', ')}. The Attio node only supports lists for a single object, like those created in Attio today. Choose a different list, or add the record to this one in Attio.`,
				itemIndex: 'getItemIndex' in context ? context.getItemIndex() : undefined,
			},
		);
	}

	return parentObjects[0];
}
