import type { INodeProperties } from 'n8n-workflow';

type BodyOf<TInput> = TInput extends { body?: infer TBody } ? NonNullable<TBody> : never;

/**
 * Routes a node parameter into the request body. The property must exist in the body
 * of the generated operation input, so a renamed or removed API field fails the build.
 */
export function bodyField<TInput>(property: Extract<keyof BodyOf<TInput>, string>) {
	return { send: { type: 'body', property } } satisfies INodeProperties['routing'];
}
