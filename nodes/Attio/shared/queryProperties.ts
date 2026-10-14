import type { INodeProperties } from 'n8n-workflow';

type QueryResource = 'listEntry' | 'record';

const parents: Record<QueryResource, 'list' | 'object'> = {
	listEntry: 'list',
	record: 'object',
};

const nouns: Record<QueryResource, string> = {
	listEntry: 'entries',
	record: 'records',
};

// List attributes vary, so the list example filters on the parent record, as in Attio's guide
// @see https://docs.attio.com/rest-api/guides/filtering-and-sorting#paths-and-parents
const jsonFilterDefaults: Record<QueryResource, string> = {
	listEntry:
		'{\n  "path": [\n    ["candidates", "parent_record"],\n    ["people", "email_addresses"]\n  ],\n  "constraints": {\n    "email_domain": "apple.com"\n  }\n}',
	record: '{\n  "name": {\n    "$contains": "Acme"\n  }\n}',
};

// The filter and sort fields of a Get Many operation, which buildQueryBody turns into a query
export function queryProperties(resource: QueryResource): INodeProperties[] {
	const parent = parents[resource];
	const noun = nouns[resource];
	const jsonFilterDefault = jsonFilterDefaults[resource];

	const queryAttributeOptions = {
		loadOptionsMethod: 'getQueryAttributes',
		loadOptionsDependsOn: [parent],
	};

	const sortAttributeOptions = {
		loadOptionsMethod: 'getQuerySortAttributes',
		loadOptionsDependsOn: [parent],
	};

	return [
		{
			displayName: 'Filter',
			name: 'filterType',
			type: 'options',
			noDataExpression: true,
			default: 'none',
			options: [
				{
					name: 'None',
					value: 'none',
				},
				{
					name: 'Build Conditions',
					value: 'conditions',
					description: `Match ${noun} against attribute conditions`,
				},
				{
					name: 'JSON',
					value: 'json',
					description: "Use an Attio filter object, for conditions the builder can't express",
				},
				{
					name: 'Saved View',
					value: 'view',
					description: `Return the ${noun} in a saved view on this ${parent}, using the view's filter`,
				},
			],
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
				},
			},
		},
		{
			displayName: 'Must Match',
			name: 'matchType',
			type: 'options',
			default: 'all',
			options: [
				{
					name: 'All Conditions',
					value: 'all',
				},
				{
					name: 'Any Condition',
					value: 'any',
				},
			],
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
					filterType: ['conditions'],
				},
			},
		},
		{
			displayName: 'Conditions',
			name: 'conditions',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Condition',
			default: {},
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
					filterType: ['conditions'],
				},
			},
			options: [
				{
					displayName: 'Condition',
					name: 'condition',
					values: [
						{
							displayName: 'Attribute Name or ID',
							name: 'attribute',
							type: 'options',
							typeOptions: queryAttributeOptions,
							default: '',
							required: true,
							description:
								'Attribute to filter on. Choose from the list, or specify an attribute slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						},
						{
							displayName: 'Field Name or ID',
							name: 'field',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getQueryFilterFields',
								loadOptionsDependsOn: ['&attribute'],
							},
							default: '',
							description:
								'Part of the attribute\'s value to compare, such as the domain of an email address. Record references compare the referenced record\'s ID, or the domain or email address of a referenced company or person. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						},
						{
							displayName: 'Operator',
							name: 'operator',
							type: 'options',
							default: 'equals',
							description:
								"Not every attribute type supports every operator. Attio returns an error if the attribute doesn't support it. Record references, such as a person's company, can't be checked for being empty.",
							options: [
								{
									name: 'Contains',
									value: 'contains',
								},
								{
									name: 'Does Not Contain',
									value: 'notContains',
								},
								{
									name: 'Ends With',
									value: 'endsWith',
								},
								{
									name: 'Equals',
									value: 'equals',
								},
								{
									name: 'Greater Than',
									value: 'greaterThan',
								},
								{
									name: 'Greater Than or Equal',
									value: 'greaterThanOrEqual',
								},
								{
									name: 'Is Empty',
									value: 'isEmpty',
								},
								{
									name: 'Is Not Empty',
									value: 'isNotEmpty',
								},
								{
									name: 'Is One Of',
									value: 'isOneOf',
								},
								{
									name: 'Less Than',
									value: 'lessThan',
								},
								{
									name: 'Less Than or Equal',
									value: 'lessThanOrEqual',
								},
								{
									name: 'Not Equals',
									value: 'notEquals',
								},
								{
									name: 'Starts With',
									value: 'startsWith',
								},
							],
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							description:
								'Value to compare against. Dates use ISO 8601, like 2026-10-13. For "Is One Of", separate values with commas.',
							displayOptions: {
								hide: {
									operator: ['isEmpty', 'isNotEmpty'],
								},
							},
						},
					],
				},
			],
		},
		{
			displayName: 'Filter (JSON)',
			name: 'filterJson',
			type: 'json',
			default: jsonFilterDefault,
			required: true,
			description: `An Attio filter object. Supports $and, $or and $not, and filtering through record references with paths${resource === 'listEntry' ? ', including the parent record with a path that starts with [list, "parent_record"]' : ''}. See the <a href="https://docs.attio.com/rest-api/guides/filtering-and-sorting">filtering guide</a>.`,
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
					filterType: ['json'],
				},
			},
		},
		{
			displayName: 'View ID',
			name: 'viewId',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. cf7aaeb5-7507-4a84-9c26-9d36e34d7b70',
			description: `UUID of a saved view on this ${parent}. Only the view's filter is used; its sorting and visible attributes are not.`,
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
					filterType: ['view'],
				},
			},
		},
		{
			displayName: 'Sort',
			name: 'sort',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: true,
			},
			placeholder: 'Add Sort Rule',
			default: {},
			description: 'Order of the results. Later rules break ties in earlier ones.',
			displayOptions: {
				show: {
					resource: [resource],
					operation: ['getAll'],
				},
			},
			options: [
				{
					displayName: 'Rule',
					name: 'rule',
					values: [
						{
							displayName: 'Attribute Name or ID',
							name: 'attribute',
							type: 'options',
							typeOptions: sortAttributeOptions,
							default: '',
							required: true,
							description:
								'Attribute to sort by. Choose from the list, or specify an attribute slug or ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						},
						{
							displayName: 'Field Name or ID',
							name: 'field',
							type: 'options',
							typeOptions: {
								loadOptionsMethod: 'getQuerySortFields',
								loadOptionsDependsOn: ['&attribute'],
							},
							default: '',
							description:
								'Part of the attribute\'s value to sort by, such as the last name. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
						},
						{
							displayName: 'Direction',
							name: 'direction',
							type: 'options',
							default: 'asc',
							options: [
								{
									name: 'Ascending',
									value: 'asc',
								},
								{
									name: 'Descending',
									value: 'desc',
								},
							],
						},
					],
				},
			],
		},
	];
}
