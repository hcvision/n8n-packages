import type { INodeProperties } from 'n8n-workflow';

import { createFields, createOption } from './create.action';

export const contactEntryResource = { name: 'Contact Entry', value: 'contactEntry' } as const;

export const contactEntryProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [contactEntryResource.value] } },
		options: [createOption],
		default: 'create',
	},
	...createFields,
];
