import type { INodeProperties } from 'n8n-workflow';

import { ticketProperties, ticketResource } from './ticket';

export const resourceProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [ticketResource],
		default: ticketResource.value,
	},
	...ticketProperties,
];
