import type { IPostReceiveRootProperty } from 'n8n-workflow';

// Attio wraps every response body in `data`
export const unwrapResponse: IPostReceiveRootProperty = {
	type: 'rootProperty',
	properties: {
		property: 'data',
	},
};
