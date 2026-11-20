import type { IAuthenticateGeneric, ICredentialType, INodeProperties } from 'n8n-workflow';

interface CredentialConfig {
	name: string;
	displayName: string;
}

interface OAuthCredentialConfig extends CredentialConfig {
	scopes: readonly string[];
	grantType?: 'pkce' | 'clientCredentials';
	clientId?: string;
	authorizationUrl?: string;
	accessTokenUrl: string;
}

abstract class ApiCredential implements ICredentialType {
	abstract name: string;

	abstract displayName: string;

	properties: INodeProperties[];

	protected constructor() {
		this.properties = [];
	}
}

export class ApiKeyCredential extends ApiCredential {
	name: string;

	displayName: string;

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	constructor(config: CredentialConfig) {
		super();
		this.name = config.name;
		this.displayName = config.displayName;
		this.properties.push({
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		});
	}
}

export class OAuth2Credential extends ApiCredential {
	name: string;

	displayName: string;

	extends = ['oAuth2Api'];

	constructor(config: OAuthCredentialConfig) {
		super();
		this.name = config.name;
		this.displayName = config.displayName;
		const grantType = config.grantType ?? 'pkce';
		this.properties.push(
			{
				displayName: 'Grant Type',
				name: 'grantType',
				type: 'hidden',
				default: grantType,
			},
			{
				displayName: 'Client ID',
				name: 'clientId',
				type: 'string',
				default: config.clientId ?? '',
				required: true,
				description: 'Keycloak client used for this sign-in; also required for PKCE',
			},
			{
				displayName: 'Client Secret',
				name: 'clientSecret',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: grantType === 'clientCredentials',
				description:
					grantType === 'clientCredentials'
						? 'Configure this in n8n; the generator does not supply a client secret.'
						: 'Optional for public PKCE clients; required only for confidential clients',
			},
		);

		if (grantType === 'pkce') {
			this.properties.push({
				displayName: 'Authorization URL',
				name: 'authUrl',
				type: 'string',
				default: config.authorizationUrl ?? '',
				required: true,
			});
		}

		this.properties.push(
			{
				displayName: 'Access Token URL',
				name: 'accessTokenUrl',
				type: 'string',
				default: config.accessTokenUrl,
				required: true,
			},
			{
				displayName: 'Scope',
				name: 'scope',
				type: 'string',
				default: config.scopes.join(' '),
				description:
					'Space-separated OAuth scopes required by your workflow; see the endpoint documentation and include webhook scopes when using triggers',
			},
			{
				displayName: 'Authentication',
				name: 'authQueryParameters',
				type: 'hidden',
				default: '',
			},
		);
	}
}
