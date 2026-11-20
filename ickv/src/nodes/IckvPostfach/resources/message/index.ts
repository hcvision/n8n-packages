import type { INodeProperties } from 'n8n-workflow';

import { createFields, createOption } from './create.action';

export const messageResource = { name: 'Message', value: 'message' } as const;

export const messageProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [messageResource.value] } },
		options: [createOption],
		default: 'create',
	},
	...createFields,
];
