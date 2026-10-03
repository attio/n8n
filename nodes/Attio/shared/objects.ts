import type { INodePropertyTypeOptions } from 'n8n-workflow';
import { unwrapResponse } from './output';

// Lists the workspace's objects, keyed by slug, falling back to ID for objects without one
export const objectOptions: INodePropertyTypeOptions = {
	loadOptions: {
		routing: {
			request: {
				method: 'GET',
				url: '/objects',
			},
			output: {
				postReceive: [
					unwrapResponse,
					{
						type: 'setKeyValue',
						properties: {
							name: '={{ $responseItem.plural_noun ?? $responseItem.api_slug ?? $responseItem.id.object_id }}',
							value: '={{ $responseItem.api_slug ?? $responseItem.id.object_id }}',
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
