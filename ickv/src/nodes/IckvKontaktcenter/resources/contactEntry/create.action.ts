import type { IDataObject, INodeProperties, INodePropertyOptions } from 'n8n-workflow';

import { bodyField } from '../../../../shared/typedRouting';
import { simplifyOutput, simplifyProperty } from '../../../../shared/simplifyOutput';
import type {
	ApiHcvIckvKontaktcenterApiV10,
	PostKontakteintraegeOnUserRequestInput,
} from '../../../../openApi/IckvKontaktcenter';
import { ickvKontaktcenterKontakteintragOperations } from '../../../../openApi/IckvKontaktcenter';

const operation = ickvKontaktcenterKontakteintragOperations.postKontakteintraegeOnUserRequest;

const show = { resource: ['contactEntry'], operation: ['create'] };

/** The most useful fields of the created contact entry, with the nested values flattened. */
export function simplifyContactEntry(
	entry: ApiHcvIckvKontaktcenterApiV10.KontakteintragResponse,
): IDataObject {
	return {
		id: entry.id,
		hcvUid: entry.uid,
		created: entry.erstellungsdatum,
		category: entry.kategorie && {
			id: entry.kategorie.id,
			name: entry.kategorie.name,
			prefix: entry.kategorie.prefixKontakteintrag,
		},
		group: entry.gruppe && {
			id: entry.gruppe.id,
			name: entry.gruppe.name,
			prefix: entry.gruppe.prefixKontakteintrag,
		},
		type: entry.typ && { id: entry.typ.id, name: entry.typ.bezeichnung },
		kind: entry.kontakteintragArt,
		state: entry.status,
		title: entry.titel,
		remark: entry.bemerkung,
	} as IDataObject;
}

export const createOption: INodePropertyOptions = {
	name: 'Create',
	value: 'create',
	action: 'Create contact entry',
	description: 'Create a new contact entry manually, without a document reference',
	routing: {
		request: {
			method: operation.method,
			url: `=${operation.path}`,
			headers: { 'Content-Type': 'multipart/form-data' },
		},
		output: { postReceive: [simplifyOutput(simplifyContactEntry)] },
	},
};

export const createFields: INodeProperties[] = [
	{
		displayName: 'HCV UID',
		name: 'uid',
		type: 'string',
		required: true,
		default: '',
		description: 'GUID of the person the contact entry belongs to',
		displayOptions: { show },
		routing: bodyField<PostKontakteintraegeOnUserRequestInput>('Uid'),
	},
	{
		displayName: 'Group ID',
		name: 'gruppeId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show },
		routing: bodyField<PostKontakteintraegeOnUserRequestInput>('GruppeId'),
	},
	{
		displayName: 'Category ID',
		name: 'kategorieId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show },
		routing: bodyField<PostKontakteintraegeOnUserRequestInput>('KategorieId'),
	},
	{
		displayName: 'Type ID',
		name: 'typId',
		type: 'number',
		required: true,
		default: 0,
		displayOptions: { show },
		routing: bodyField<PostKontakteintraegeOnUserRequestInput>('TypId'),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Remark',
				name: 'bemerkung',
				type: 'string',
				default: '',
				placeholder: 'e.g. Customer asked for a callback',
				routing: bodyField<PostKontakteintraegeOnUserRequestInput>('Bemerkung'),
			},
			{
				displayName: 'Title',
				name: 'titel',
				type: 'string',
				default: '',
				placeholder: 'e.g. Callback request',
				routing: bodyField<PostKontakteintraegeOnUserRequestInput>('Titel'),
			},
		],
	},
	simplifyProperty(show),
];
