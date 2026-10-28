import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type ILoadOptionsFunctions,
	type IWebhookFunctions,
} from 'n8n-workflow';

export const attioBaseUrl = 'https://api.attio.com/v2';

type AttioContext =
	| ILoadOptionsFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| IWebhookFunctions;

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// For load methods, preSend functions and the trigger, which can't use declarative routing.
// Attio wraps every response body in `data`, which is checked against the shape the caller expects
export async function attioRequest<T>(
	context: AttioContext,
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
	context: AttioContext,
	path: string,
	isData: (data: unknown) => data is T,
	expected: string,
): Promise<T> {
	return await attioRequest(context, { method: 'GET', path }, isData, expected);
}

// Attio list endpoints return { data: [...] }, and each item is checked
export async function attioGetList<T>(
	context: AttioContext,
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

// Cursor-paginated endpoints return the next page's cursor beside `data`, until it's null
export async function attioGetAllByCursor<T>(
	context: AttioContext,
	path: string,
	isItem: (item: unknown) => item is T,
	pageSize: number,
): Promise<T[]> {
	const items: T[] = [];
	let cursor: string | null = null;

	do {
		const response: unknown = await context.helpers.httpRequestWithAuthentication.call(
			context,
			'attioApi',
			{
				method: 'GET',
				url: `${attioBaseUrl}${path}`,
				qs: cursor === null ? { limit: pageSize } : { limit: pageSize, cursor },
				json: true,
			},
		);

		const data = isObject(response) ? response.data : undefined;
		const pagination = isObject(response) ? response.pagination : undefined;
		const nextCursor = isObject(pagination) ? pagination.next_cursor : undefined;
		if (
			!Array.isArray(data) ||
			!data.every(isItem) ||
			(typeof nextCursor !== 'string' && nextCursor !== null)
		) {
			throw new NodeOperationError(context.getNode(), 'Unexpected response from Attio', {
				description: `GET ${path} didn't return the expected list`,
			});
		}

		items.push(...data);
		cursor = nextCursor;
	} while (cursor !== null);

	return items;
}
