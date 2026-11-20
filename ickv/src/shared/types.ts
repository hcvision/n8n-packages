export type HttpMethod = 'DELETE' | 'GET' | 'POST' | 'PUT';

export type AuthenticationType = 'none' | 'apiKey' | 'oauth2';

export interface ParameterDefinition {
	name: string;
	displayName: string;
	in: 'form' | 'header' | 'path' | 'query';
	required: boolean;
	type: 'array' | 'binary' | 'boolean' | 'number' | 'options' | 'string';
	options?: Array<{ name: string; value: number | string }>;
	description?: string;
}

export interface OperationDefinition {
	id: string;
	displayName: string;
	description: string;
	deprecated?: boolean;
	method: HttpMethod;
	path: string;
	auth: AuthenticationType;
	authMethod: string;
	parameters: ParameterDefinition[];
	body?: {
		required: boolean;
		schemaName: string;
		requiredProperties: string[];
		template?: unknown;
		contentType?: 'json' | 'multipart';
		fields?: ParameterDefinition[];
	};
}

export interface ResourceDefinition {
	name: string;
	value: string;
	description: string;
	auth: AuthenticationType;
	authMethod: string;
	operations: OperationDefinition[];
}
