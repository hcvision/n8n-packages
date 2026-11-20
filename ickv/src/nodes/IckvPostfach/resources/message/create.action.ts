import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { bodyField } from '../../../../shared/typedRouting';
import type { PostPostfachMessagesInput } from '../../../../openApi/IckvPostfach';
import { ickvPostfachPostfachOperations } from '../../../../openApi/IckvPostfach';

const operation = ickvPostfachPostfachOperations.postPostfachMessages;
const show = { resource: ['message'], operation: ['create'] };

export const createOption: INodePropertyOptions = {
	name: 'Create',
	value: 'create',
	action: 'Create message',
	description:
		'Create a new message with an entry in the sender outbox and one entry per recipient',
	routing: {
		request: {
			method: operation.method,
			url: `=${operation.path}`,
			headers: { 'Content-Type': 'multipart/form-data' },
		},
	},
};

export const createFields: INodeProperties[] = [
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				placeholder: 'e.g. Your request has been processed',
				routing: bodyField<PostPostfachMessagesInput>('Body'),
			},
			{
				displayName: 'Customer Reference',
				name: 'customerReference',
				type: 'string',
				default: '',
				routing: bodyField<PostPostfachMessagesInput>('CustomerReference'),
			},
			{
				displayName: 'Important',
				name: 'isImportant',
				type: 'boolean',
				description: 'Whether the message is marked as important',
				default: false,
				routing: bodyField<PostPostfachMessagesInput>('IsImportant'),
			},
			{
				displayName: 'Recipient HCV UID',
				name: 'toUid',
				type: 'string',
				default: '',
				description: 'GUID of the recipient',
				routing: bodyField<PostPostfachMessagesInput>('ToUid'),
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				placeholder: 'e.g. Update on your request',
				routing: bodyField<PostPostfachMessagesInput>('Subject'),
			},
			{
				displayName: 'Subject Topic ID',
				name: 'subjectTopicId',
				type: 'string',
				default: '',
				routing: bodyField<PostPostfachMessagesInput>('SubjectTopicId'),
			},
		],
	},
];
