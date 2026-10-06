import type { IDataObject, ILoadOptionsFunctions } from 'n8n-workflow';

export const attioBaseUrl = 'https://api.attio.com/v2';

// For load methods, which can't use the node's declarative routing
export async function attioGet(this: ILoadOptionsFunctions, path: string): Promise<unknown> {
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'attioApi', {
		method: 'GET',
		url: `${attioBaseUrl}${path}`,
		json: true,
	})) as IDataObject;

	return response.data;
}
