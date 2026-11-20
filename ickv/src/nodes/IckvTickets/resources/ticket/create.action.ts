import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';

import { bodyField } from '../../../../shared/typedRouting';
import { simplifyOutput, simplifyProperty } from '../../../../shared/simplifyOutput';
import type {
	ApiHcvIckvTicketsApiV10,
	CreateTicketShortInput,
} from '../../../../openApi/IckvTickets';
import { ickvTicketsTicketInstanceOperations } from '../../../../openApi/IckvTickets';

const operation = ickvTicketsTicketInstanceOperations.createTicketShort;
const show = { resource: ['ticket'], operation: ['create'] };

/** The most useful fields of the created ticket, with the nested values flattened. */
export function simplifyTicket(ticket: ApiHcvIckvTicketsApiV10.Ticket): IDataObject {
	return {
		id: ticket.id,
		hcvUid: ticket.uid,
		type: ticket.typ,
		category: ticket.ticketKategorie && {
			id: ticket.ticketKategorie.kat,
			name: ticket.ticketKategorie.name,
		},
		group: ticket.ticketGruppe && {
			id: ticket.ticketGruppe.grp,
			name: ticket.ticketGruppe.name,
			private: ticket.ticketGruppe.private,
		},
		state: ticket.status,
		created: ticket.createdDateTime,
		orga: ticket.orga,
		due: ticket.faellig,
		variables: ticket.ticketVarInfos?.map((variable) => ({
			position: variable.pos,
			type: variable.fieldTyp,
			value: variable.textValue ?? variable.dateValue ?? variable.floatValue,
		})),
	} as IDataObject;
}

export const createOption: INodePropertyOptions = {
	name: 'Create',
	value: 'create',
	action: 'Create ticket',
	description: 'Create a new ticket with only the required information',
	routing: {
		request: {
			method: operation.method,
			url: `=${operation.path}`,
		},
		send: { preSend: [sendEmptyTriggerByDefault] },
		output: { postReceive: [simplifyOutput(simplifyTicket)] },
	},
};

type TicketVarInfos = NonNullable<NonNullable<CreateTicketShortInput['body']>['ticketVarInfos']>;

/** Name of the collection that holds the optional fields; must match the field definition below. */
const additionalFieldsName = 'additionalFields';

interface TicketVariableEntry {
	pos: number;
	valueType: 'text' | 'date' | 'float';
	textValue?: string;
	dateValue?: string;
	floatValue?: number;
}

/** Shape of the collection as defined in createFields; n8n returns it untyped at runtime. */
interface AdditionalFields {
	ticketVarInfos?: { variable?: TicketVariableEntry[] };
}

/** The API requires the trigger, so an empty string is sent when none is set. */
async function sendEmptyTriggerByDefault(
	this: IExecuteSingleFunctions,
	options: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body = { trigger: '', ...(options.body as object) };

	options.body = body;

	return options;
}

/** Sends the ticket variables entered as fields as an array in the request body. */
async function setTicketVarInfos(
	this: IExecuteSingleFunctions,
	options: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const additionalFields = this.getNodeParameter(additionalFieldsName, {}) as AdditionalFields;
	const entries = additionalFields.ticketVarInfos?.variable ?? [];

	const variables: TicketVarInfos = entries.map((entry) => ({
		pos: entry.pos,
		...(entry.valueType === 'text' && { textValue: entry.textValue ?? '' }),
		...(entry.valueType === 'date' && { dateValue: entry.dateValue }),
		...(entry.valueType === 'float' && { floatValue: entry.floatValue ?? 0 }),
	}));

	const body = { ...(options.body as object), ticketVarInfos: variables };

	options.body = body;

	return options;
}

export const createFields: INodeProperties[] = [
	{
		displayName: 'Ticket Type',
		name: 'ticketTyp',
		type: 'number',
		required: true,
		default: 0,
		description: 'ID of the ticket type',
		displayOptions: { show },
		routing: bodyField<CreateTicketShortInput>('ticketTyp'),
	},
	{
		displayName: 'HCV UID',
		name: 'uid',
		type: 'string',
		required: true,
		default: '',
		description: 'GUID of the person the ticket belongs to',
		displayOptions: { show },
		routing: bodyField<CreateTicketShortInput>('uid'),
	},
	{
		displayName: 'Additional Fields',
		name: additionalFieldsName,
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Ticket Variables',
				name: 'ticketVarInfos',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Variable',
				default: {},
				description: 'Variables of the ticket, identified by their position',
				routing: { send: { preSend: [setTicketVarInfos] } },
				options: [
					{
						displayName: 'Variable',
						name: 'variable',
						values: [
							{
								displayName: 'Position',
								name: 'pos',
								type: 'number',
								default: 0,
								description: 'Position of the ticket variable',
							},
							{
								displayName: 'Value Type',
								name: 'valueType',
								type: 'options',
								options: [
									{ name: 'Text', value: 'text' },
									{ name: 'Date', value: 'date' },
									{ name: 'Number', value: 'float' },
								],
								default: 'text',
							},
							{
								displayName: 'Text Value',
								name: 'textValue',
								type: 'string',
								default: '',
								displayOptions: { show: { valueType: ['text'] } },
							},
							{
								displayName: 'Date Value',
								name: 'dateValue',
								type: 'dateTime',
								default: '',
								displayOptions: { show: { valueType: ['date'] } },
							},
							{
								displayName: 'Number Value',
								name: 'floatValue',
								type: 'number',
								default: 0,
								displayOptions: { show: { valueType: ['float'] } },
							},
						],
					},
				],
			},
			{
				displayName: 'Trigger',
				name: 'trigger',
				type: 'string',
				default: '',
				routing: bodyField<CreateTicketShortInput>('trigger'),
			},
		],
	},
	simplifyProperty(show),
];
