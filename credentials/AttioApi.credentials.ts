import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AttioApi implements ICredentialType {
	name = 'attioApi';

	displayName = 'Attio API';

	icon: Icon = { light: 'file:../icons/attio.svg', dark: 'file:../icons/attio.dark.svg' };

	documentationUrl = 'https://docs.attio.com/rest-api/guides/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.attio.com/v2',
			url: '/self',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'active',
					value: false,
					message: 'Access token is invalid or has been revoked',
				},
			},
		],
	};
}
