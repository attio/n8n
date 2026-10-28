import type { INodeProperties, IN8nRequestOperationPaginationOffset } from 'n8n-workflow';

// Always paginates; "Limit" caps the results via maxResults, so any limit works regardless of page size
export function offsetPagination(pageSize: number): {
	send: { paginate: true };
	operations: { pagination: IN8nRequestOperationPaginationOffset };
} {
	return {
		send: {
			paginate: true,
		},
		operations: {
			pagination: {
				type: 'offset',
				properties: {
					limitParameter: 'limit',
					offsetParameter: 'offset',
					pageSize,
					type: 'query',
				},
			},
		},
	};
}

export function returnAllFields(resource: string): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: {
				minValue: 1,
			},
			default: 50,
			description: 'Max number of results to return',
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
					returnAll: [false],
				},
			},
			routing: {
				output: {
					maxResults: '={{ $value }}',
				},
			},
		},
	];
}
