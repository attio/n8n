import type { INodePropertyTypeOptions } from 'n8n-workflow';
import { unwrapResponse } from './output';
import { isObject } from './request';

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
