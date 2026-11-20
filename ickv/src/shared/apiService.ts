import type {
	IExecuteFunctions,
	IHookFunctions,
	ITriggerFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

import { readApiBasePath } from './apiUrl';
import { apiBaseUrlLabel, checkInCredentialHint } from './apiUrlLabels';
import { buildRequestOptions, validateApiBasePath, validateApiBaseUrl } from './request';
import type { OperationDefinition } from './types';

/** n8n contexts supported by custom action, trigger, and webhook handlers. */
export type ApiServiceContext =
	| IExecuteFunctions
	| IHookFunctions
	| ITriggerFunctions
	| IWebhookFunctions;

/** Successful HTTP response data returned by an endpoint service. */
export interface ApiServiceResponse<TBody = unknown> {
	body?: TBody;
	statusCode?: number;
}

/** Maps an n8n node parameter to credential types for selectable auth variants. */
export interface ApiServiceCredentialVariants {
	parameterName: string;
	defaultVariant: string;
	variants: Record<string, string>;
}

/** Runtime configuration generated from the API and node definitions. */
export interface ApiServiceConfig {
	apiBaseUrlCredentialType: string;
	apiBasePathField: string;
	apiBasePath: string;
	credentialTypes: Record<string, string | ApiServiceCredentialVariants>;
}

/** Flat path and query parameters, plus separate headers and request body. */
export interface ApiServiceValues<TBody = unknown> {
	[parameter: string]: unknown;
	header?: Record<string, unknown>;
	body?: TBody;
}

/** Executes one generated endpoint using credentials and parameters from its owning n8n node. */
export async function executeApiServiceOperation<
	TValues extends ApiServiceValues = ApiServiceValues,
	TResponse = unknown,
>(
	context: ApiServiceContext,
	config: ApiServiceConfig,
	operation: OperationDefinition,
	values: TValues,
	itemIndex = 0,
): Promise<ApiServiceResponse<TResponse>> {
	return await new ApiServiceClient(context, config, itemIndex).execute<TValues, TResponse>(
		operation,
		values,
	);
}

/** Executes endpoints with the owning node's context, configuration and item index. */
export class ApiServiceClient {
	constructor(
		private readonly context: ApiServiceContext,
		private readonly config: ApiServiceConfig,
		private readonly itemIndex = 0,
	) {}

	/** Resolves current node parameters and credentials for each request without caching secrets. */
	async execute<TValues extends ApiServiceValues = ApiServiceValues, TResponse = unknown>(
		operation: OperationDefinition,
		values: TValues,
	): Promise<ApiServiceResponse<TResponse>> {
		const { context, config, itemIndex } = this;
		const baseUrlCredentials = await context.getCredentials(
			config.apiBaseUrlCredentialType,
			itemIndex,
		);

		if (typeof baseUrlCredentials.apiBaseUrl !== 'string') {
			throw new Error(`'${apiBaseUrlLabel}' is missing. ${checkInCredentialHint()}`);
		}

		const apiBasePath = readApiBasePath(
			baseUrlCredentials,
			config.apiBasePathField,
			config.apiBasePath,
		);

		const requestOptions = buildRequestOptions(
			validateApiBaseUrl(baseUrlCredentials.apiBaseUrl),
			validateApiBasePath(apiBasePath),
			operation,
			{
				path: values,
				optional: values,
				header: values.header ?? {},
				body: values.body,
			},
		);

		if (operation.auth === 'none') {
			return (await context.helpers.httpRequest.call(
				context,
				requestOptions,
			)) as ApiServiceResponse<TResponse>;
		}

		const credentialDefinition = config.credentialTypes[operation.authMethod];
		if (!credentialDefinition) {
			throw new Error(`No credential type configured for auth method "${operation.authMethod}"`);
		}

		const credentialType =
			typeof credentialDefinition === 'string'
				? credentialDefinition
				: credentialDefinition.variants[
						String(
							getNodeParameter(
								context,
								credentialDefinition.parameterName,
								itemIndex,
								credentialDefinition.defaultVariant,
							),
						)
					];

		if (!credentialType) {
			throw new Error(`No credential configured for auth method "${operation.authMethod}"`);
		}

		return (await context.helpers.httpRequestWithAuthentication.call(
			context,
			credentialType,
			requestOptions,
		)) as ApiServiceResponse<TResponse>;
	}
}

function getNodeParameter(
	context: ApiServiceContext,
	parameterName: string,
	itemIndex: number,
	defaultValue: string,
): unknown {
	if ('getInputData' in context) {
		return context.getNodeParameter(parameterName, itemIndex, defaultValue);
	}

	return context.getNodeParameter(parameterName, defaultValue);
}
