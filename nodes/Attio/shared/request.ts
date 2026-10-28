import {
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHookFunctions,
	type IHttpRequestMethods,
	type ILoadOptionsFunctions,
	type IWebhookFunctions,
} from 'n8n-workflow';
import { z } from 'zod/v4';

export const attioBaseUrl = 'https://api.attio.com/v2';

type AttioContext =
	| ILoadOptionsFunctions
	| IExecuteSingleFunctions
	| IHookFunctions
	| IWebhookFunctions;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Any object, for responses that are output as they are
export const dataObjectSchema = z.custom<IDataObject>(isObject);

// Schemas list only the fields this node reads, rather than mirroring Attio's full response types.
// The value is returned as it is, not zod's parsed output, which would drop every other field, so
// records, tasks and events keep everything Attio returns
export function matches<T>(schema: z.ZodType<T>, value: unknown): value is T {
	return schema.safeParse(value).success;
}

// For load methods, preSend functions and the trigger, which can't use declarative routing.
// Attio wraps every response body in `data`, which is checked against the shape the caller expects
export async function attioRequest<T>(
	context: AttioContext,
	request: { method: IHttpRequestMethods; path: string; body?: IDataObject },
	schema: z.ZodType<T>,
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
	if (!matches(schema, data)) {
		throw new NodeOperationError(context.getNode(), 'Unexpected response from Attio', {
			description: `${method} ${path} didn't return the expected ${expected}`,
		});
	}

	return data;
}

export async function attioGet<T>(
	context: AttioContext,
	path: string,
	schema: z.ZodType<T>,
	expected: string,
): Promise<T> {
	return await attioRequest(context, { method: 'GET', path }, schema, expected);
}

// Attio list endpoints return { data: [...] }, and each item is checked
export async function attioGetList<T>(
	context: AttioContext,
	path: string,
	itemSchema: z.ZodType<T>,
): Promise<T[]> {
	return await attioGet(context, path, z.array(itemSchema), 'list');
}

// Cursor-paginated endpoints return the next page's cursor beside `data`, until it's null
export async function attioGetAllByCursor<T>(
	context: AttioContext,
	path: string,
	itemSchema: z.ZodType<T>,
	pageSize: number,
): Promise<T[]> {
	const pageSchema = z.object({
		data: z.array(itemSchema),
		pagination: z.object({ next_cursor: z.string().nullable() }),
	});
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

		if (!matches(pageSchema, response)) {
			throw new NodeOperationError(context.getNode(), 'Unexpected response from Attio', {
				description: `GET ${path} didn't return the expected list`,
			});
		}

		items.push(...response.data);
		cursor = response.pagination.next_cursor;
	} while (cursor !== null);

	return items;
}
