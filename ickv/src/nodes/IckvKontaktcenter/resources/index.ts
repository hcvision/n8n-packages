import type { INodeProperties } from 'n8n-workflow';

import { contactEntryProperties, contactEntryResource } from './contactEntry';

export const resourceProperties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [contactEntryResource],
		default: contactEntryResource.value,
	},
	...contactEntryProperties,
];
