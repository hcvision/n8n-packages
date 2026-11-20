import type { INodeProperties } from 'n8n-workflow';

import { messageProperties, messageResource } from './message';

export const resourceProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [messageResource],
		default: messageResource.value,
	},
	...messageProperties,
];
