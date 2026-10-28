import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestMethods,
	type ILoadOptionsFunctions,
} from 'n8n-workflow';

export const attioBaseUrl = 'https://api.attio.com/v2';

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// For load methods and preSend functions, which can't use the node's declarative routing.
// Attio wraps every response body in `data`, which is checked against the shape the caller expects
export async function attioRequest<T>(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	request: { method: IHttpRequestMethods; path: string; body?: IDataObject },
	isData: (data: unknown) => data is T,
	expected: string,
): Promise<T> {
	const { method, path, body } = request;
	const response: unknown = await context.helpers.httpRequestWithAuthentication.call(
		context,
		'attioApi',
		{
			method,
			url: `${attioBaseUrl}${path}`,
			body,
			json: true,
		},
	);

	const data = isObject(response) ? response.data : undefined;
	if (!isData(data)) {
		throw new NodeOperationError(context.getNode(), 'Unexpected response from Attio', {
			description: `${method} ${path} didn't return the expected ${expected}`,
		});
	}

	return data;
}

export async function attioGet<T>(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	path: string,
	isData: (data: unknown) => data is T,
	expected: string,
): Promise<T> {
	return await attioRequest(context, { method: 'GET', path }, isData, expected);
}

// Attio list endpoints return { data: [...] }, and each item is checked
export async function attioGetList<T>(
	context: ILoadOptionsFunctions | IExecuteSingleFunctions,
	path: string,
	isItem: (item: unknown) => item is T,
): Promise<T[]> {
	return await attioGet(
		context,
		path,
		(data): data is T[] => Array.isArray(data) && data.every(isItem),
		'list',
	);
}
