import type {
	ICredentialDataDecryptedObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { apiBasePathLabel, apiBaseUrlLabel, checkInCredentialHint } from './apiUrlLabels';
import { validateApiBasePath, validateApiBaseUrl } from './request';

/** Where a node finds its API URL in the shared API URL credential. */
export interface ApiUrlConfig {
	credentialType: string;
	basePathField: string;
	defaultBasePath: string;
}

/**
 * Reads the API base path of a node from the API URL credential. Credentials saved before the
 * field existed fall back to the generated default.
 */
export function readApiBasePath(
	credentials: ICredentialDataDecryptedObject,
	basePathField: string,
	defaultBasePath: string,
): string {
	const value = credentials[basePathField];
	if (value === undefined) return defaultBasePath;
	if (typeof value !== 'string') {
		throw new Error(`'${apiBasePathLabel}' must be text. ${checkInCredentialHint()}`);
	}

	return value;
}

/** Joins the gateway URL and the API base path of a node. */
export function buildApiBaseUrl(
	credentials: ICredentialDataDecryptedObject,
	basePathField: string,
	defaultBasePath: string,
): string {
	if (typeof credentials.apiBaseUrl !== 'string') {
		throw new Error(`'${apiBaseUrlLabel}' is missing. ${checkInCredentialHint()}`);
	}

	const basePath = readApiBasePath(credentials, basePathField, defaultBasePath);

	return (
		validateApiBaseUrl(credentials.apiBaseUrl).replace(/\/+$/, '') +
		(basePath === '' ? '' : validateApiBasePath(basePath).replace(/\/+$/, ''))
	);
}

/** Creates a declarative routing `preSend` action that sets the request base URL from the API URL credential. */
export function apiBaseUrlPreSend(config: ApiUrlConfig) {
	return async function setApiBaseUrl(
		this: IExecuteSingleFunctions,
		options: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const credentials = await this.getCredentials(config.credentialType);
		try {
			options.baseURL = buildApiBaseUrl(credentials, config.basePathField, config.defaultBasePath);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), (error as Error).message, {
				itemIndex: this.getItemIndex(),
			});
		}

		return options;
	};
}
