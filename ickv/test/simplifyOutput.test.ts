import { describe, expect, it } from 'vitest';
import type { IExecuteSingleFunctions } from 'n8n-workflow';

import { simplifyOutput } from '../src/shared/simplifyOutput';

function context(simplify: boolean) {
	return { getNodeParameter: () => simplify } as unknown as IExecuteSingleFunctions;
}

const items = [{ json: { id: 1, extra: 'x' } }];
const response = {} as never;

describe('simplifyOutput', () => {
	it('maps each item when Simplify is on', async () => {
		const result = await simplifyOutput((r: { id: number }) => ({ id: r.id })).call(
			context(true),
			items,
			response,
		);

		expect(result).toEqual([{ json: { id: 1 } }]);
	});

	it('keeps the raw data when Simplify is off', async () => {
		const result = await simplifyOutput(() => ({})).call(context(false), items, response);

		expect(result).toBe(items);
	});
});
