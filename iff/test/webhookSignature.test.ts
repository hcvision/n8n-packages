import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { isValidSignature } from '../src/shared/WebhookTriggerNode';

const key = Buffer.from('0123456789abcdef0123456789abcdef');
const secret = `whsec_${key.toString('base64')}`;
const eventId = '6f1c2b7e-0000-4000-8000-000000000001';
const now = 1_800_000_000;
const body = Buffer.from('{"type":"hcv:test","data":{}}');

function sign(signingKey: Buffer, id = eventId, timestamp = now, payload = body): string {
	const digest = createHmac('sha256', signingKey)
		.update(`${id}.${timestamp}.`)
		.update(payload)
		.digest('base64');
	return `v1,${digest}`;
}

describe('isValidSignature', () => {
	it('accepts a correct signature', () => {
		expect(isValidSignature(secret, eventId, String(now), body, sign(key), now)).toBe(true);
	});

	it('accepts the signature of the current secret during a rotation', () => {
		const previous = Buffer.from('previous-secret-previous-secret!');
		const header = `${sign(previous)} ${sign(key)}`;

		expect(isValidSignature(secret, eventId, String(now), body, header, now)).toBe(true);
	});

	it('rejects a signature of another secret', () => {
		const other = Buffer.from('another-secret-another-secret-12');

		expect(isValidSignature(secret, eventId, String(now), body, sign(other), now)).toBe(false);
	});

	it('rejects a changed body', () => {
		const changed = Buffer.from('{"type":"hcv:test","data":{"a":1}}');

		expect(isValidSignature(secret, eventId, String(now), changed, sign(key), now)).toBe(false);
	});

	it('rejects a changed event id', () => {
		expect(isValidSignature(secret, 'other-id', String(now), body, sign(key), now)).toBe(false);
	});

	it('rejects a timestamp outside of the tolerance', () => {
		const old = now - 301;

		expect(isValidSignature(secret, eventId, String(old), body, sign(key, eventId, old), now)).toBe(
			false,
		);
	});

	it('rejects a timestamp that is not a number', () => {
		expect(isValidSignature(secret, eventId, 'abc', body, sign(key), now)).toBe(false);
	});

	it('ignores signatures of an unknown version', () => {
		const header = sign(key).replace('v1,', 'v2,');

		expect(isValidSignature(secret, eventId, String(now), body, header, now)).toBe(false);
	});

	it('rejects a malformed header', () => {
		expect(isValidSignature(secret, eventId, String(now), body, 'garbage', now)).toBe(false);
	});
});
