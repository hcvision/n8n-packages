import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';

import { apiBasePathLabel, apiBaseUrlLabel, checkInCredentialHint } from './apiUrlLabels';
import type { OperationDefinition, ParameterDefinition } from './types';

export interface RequestValues {
	path: Record<string, unknown>;
	optional: Record<string, unknown>;
	header?: Record<string, unknown>;
	body?: unknown;
}

/** Accepts only absolute HTTP(S) URLs. */
export function validateApiBaseUrl(apiBaseUrl: string): string {
	if (URL.canParse(apiBaseUrl)) {
		const url = new URL(apiBaseUrl);
		if (url.protocol === 'http:' || url.protocol === 'https:') {
			return apiBaseUrl;
		}
	}

	throw new Error(
		`'${apiBaseUrlLabel}' must be an absolute HTTP or HTTPS URL, e.g. https://example.com. ${checkInCredentialHint()}`,
	);
}

/** Accepts only absolute API base paths. */
export function validateApiBasePath(apiBasePath: string): string {
	if (apiBasePath.startsWith('/')) return apiBasePath;
	throw new Error(`'${apiBasePathLabel}' must start with a slash. ${checkInCredentialHint()}`);
}

function hasValue(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

function normalizeValue(parameter: ParameterDefinition, value: unknown): unknown {
	if (parameter.type !== 'array' || Array.isArray(value)) return value;
	if (typeof value !== 'string') return value;

	const trimmed = value.trim();
	if (trimmed.startsWith('[')) {
		const parsed: unknown = JSON.parse(trimmed);
		if (!Array.isArray(parsed)) {
			throw new Error(`'${parameter.displayName}' must be a JSON array, e.g. [1, 2, 3]`);
		}

		return parsed;
	}

	return trimmed
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => (/^-?\d+$/.test(entry) ? Number(entry) : entry));
}

export function buildRequestOptions(
	apiBaseUrl: string,
	apiBasePath: string,
	operation: OperationDefinition,
	values: RequestValues,
): IHttpRequestOptions {
	let path = operation.path;
	const qs: IDataObject = {};
	const headers: IDataObject = {
		Accept: 'application/json',
	};

	for (const parameter of operation.parameters) {
		const source =
			parameter.in === 'path'
				? values.path
				: parameter.in === 'header'
					? (values.header ?? values.optional)
					: values.optional;

		const value = source[parameter.name];
		if (!hasValue(value)) {
			if (parameter.required) {
				throw new Error(`'${parameter.displayName}' is required. Enter a value to continue.`);
			}

			continue;
		}

		const normalized = normalizeValue(parameter, value);
		if (parameter.in === 'path') {
			path = path.replace(`{${parameter.name}}`, encodeURIComponent(String(normalized)));
		} else if (parameter.in === 'query') {
			qs[parameter.name] = normalized as IDataObject[string];
		} else {
			headers[parameter.name] = normalized as IDataObject[string];
		}
	}

	const options: IHttpRequestOptions = {
		method: operation.method,
		url: [
			apiBaseUrl.replace(/\/+$/, ''),
			apiBasePath.replace(/^\/+|\/+$/g, ''),
			path.replace(/^\/+/, ''),
		]
			.filter(Boolean)
			.join('/'),
		headers,
		qs,
		arrayFormat: 'repeat',
		json: true,
		returnFullResponse: true,
	};

	if (operation.body && values.body !== undefined) {
		options.body = values.body as IDataObject;
		if (operation.body.contentType !== 'multipart') {
			headers['Content-Type'] = 'application/json';
		}
	}

	return options;
}
