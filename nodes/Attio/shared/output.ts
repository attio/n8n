import type { IPostReceiveRootProperty, IPostReceiveSet } from 'n8n-workflow';

// Attio wraps every response body in `data`
export const unwrapResponse: IPostReceiveRootProperty = {
	type: 'rootProperty',
	properties: {
		property: 'data',
	},
};

// Delete endpoints return an empty body, so emit a confirmation item instead
export const deletedResponse: IPostReceiveSet = {
	type: 'set',
	properties: {
		value: '={{ { "deleted": true } }}',
	},
};
