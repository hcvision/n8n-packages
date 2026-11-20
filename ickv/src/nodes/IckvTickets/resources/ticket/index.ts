import type { INodeProperties } from 'n8n-workflow';

import { createFields, createOption } from './create.action';

export const ticketResource = { name: 'Ticket', value: 'ticket' } as const;

export const ticketProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [ticketResource.value] } },
		options: [createOption],
		default: 'create',
	},
	...createFields,
];
