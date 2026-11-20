import { createHmac } from 'node:crypto';

import type { IWebhookFunctions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { handleWebhook, type WebhookTriggerConfig } from '../src/shared/WebhookTriggerNode';

const key = Buffer.from('0123456789abcdef0123456789abcdef');
const eventId = '6f1c2b7e-0000-4000-8000-000000000002';
const eventType = 'hcv:test';
const data = { id: 1, name: 'Ada' };
const body = Buffer.from(
	JSON.stringify({ type: eventType, timestamp: '2026-01-01T00:00:00Z', data }),
);

function context(simplify: boolean): IWebhookFunctions {
	const timestamp = String(Math.floor(Date.now() / 1000));
	const digest = createHmac('sha256', key)
		.update(`${eventId}.${timestamp}.`)
		.update(body)
		.digest('base64');
	const staticData = { secret: `whsec_${key.toString('base64')}` };

	return {
		getWorkflowStaticData: () => staticData,
		getRequestObject: () => ({
			rawBody: body,
			headers: {
				'webhook-id': eventId,
				'webhook-timestamp': timestamp,
				'webhook-signature': `v1,${digest}`,
			},
		}),
		getNodeParameter: (name: string) => (name === 'simplify' ? simplify : eventType),
		getMode: () => 'trigger',
		helpers: { returnJsonArray: (json: unknown) => [{ json }] },
		logger: { warn: () => undefined },
	} as unknown as IWebhookFunctions;
}

describe('handleWebhook output', () => {
	it('returns only the event data when Simplify is on', async () => {
		const result = await handleWebhook(context(true), {} as WebhookTriggerConfig);

		expect(result.workflowData).toEqual([[{ json: data }]]);
	});

	it('returns the whole event when Simplify is off', async () => {
		const result = await handleWebhook(context(false), {} as WebhookTriggerConfig);

		expect(result.workflowData).toEqual([
			[{ json: { id: eventId, type: eventType, timestamp: '2026-01-01T00:00:00Z', data } }],
		]);
	});
});
