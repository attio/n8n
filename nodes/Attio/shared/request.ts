import {
	NodeOperationError,
	type IExecuteSingleFunctions,
	type ILoadOptionsFunctions,
} from 'n8n-workflow';

export const attioBaseUrl = 'https://api.attio.com/v2';

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// For load methods and preSend functions, which can't use the node's declarative routing.
// Attio list endpoints return { data: [...] }, and each item is checked against the shape
// the caller expects
export async function attioGetList<T>(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	path: string,
	isItem: (item: unknown) => item is T,
): Promise<T[]> {
	const response: unknown = await context.helpers.httpRequestWithAuthentication.call(
		context,
		'attioApi',
		{
			method: 'GET',
			url: `${attioBaseUrl}${path}`,
			json: true,
		},
	);

	const data = isObject(response) ? response.data : undefined;
	if (!Array.isArray(data) || !data.every(isItem)) {
		throw new NodeOperationError(context.getNode(), 'Unexpected response from Attio', {
			description: `GET ${path} didn't return the expected list`,
		});
	}

	return data;
}
