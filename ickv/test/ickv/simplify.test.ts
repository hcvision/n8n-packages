import { describe, expect, it } from 'vitest';

import { simplifyContactEntry } from '../../src/nodes/IckvKontaktcenter/resources/contactEntry/create.action';
import { simplifyTicket } from '../../src/nodes/IckvTickets/resources/ticket/create.action';

describe('simplified create responses', () => {
	it('maps a contact entry and keeps the IDs of nested values', () => {
		const result = simplifyContactEntry({
			id: 7,
			uid: '34fc2e88-12d5-429e-b1a7-002426aa7513',
			erstellungsdatum: '2026-01-01T00:00:00Z',
			kategorie: { id: 3, name: 'Anfrage', prefixKontakteintrag: 'AN', gruppen: [{ id: 1 }] },
			gruppe: { id: 1, katId: 3, name: 'Gruppe', prefixKontakteintrag: 'GR' },
			typ: { id: 5, bezeichnung: 'Brief' },
			kontakteintragArt: 'Tickets',
			status: 'Offen',
			titel: 'Titel',
			bemerkung: 'Bemerkung',
			attachments: [],
		} as never);

		expect(result).toEqual({
			id: 7,
			hcvUid: '34fc2e88-12d5-429e-b1a7-002426aa7513',
			created: '2026-01-01T00:00:00Z',
			category: { id: 3, name: 'Anfrage', prefix: 'AN' },
			group: { id: 1, name: 'Gruppe', prefix: 'GR' },
			type: { id: 5, name: 'Brief' },
			kind: 'Tickets',
			state: 'Offen',
			title: 'Titel',
			remark: 'Bemerkung',
		});
	});

	it('maps a ticket and reduces its variables to position, type and value', () => {
		const result = simplifyTicket({
			id: 9,
			uid: '34fc2e88-12d5-429e-b1a7-002426aa7513',
			typ: 2,
			ticketKategorie: { kat: 1, name: 'Kategorie' },
			ticketGruppe: { grp: 4, name: 'Gruppe', private: false },
			status: 'Offen',
			createdDateTime: '2026-01-01T00:00:00Z',
			orga: 'Orga',
			faellig: '2026-02-01T00:00:00Z',
			ticketVarInfos: [
				{
					pos: 1,
					number: 1,
					fieldTyp: 'Text',
					textValue: 'abc',
					dateValue: null,
					floatValue: null,
				},
				{ pos: 2, number: 2, fieldTyp: 'Float', textValue: null, dateValue: null, floatValue: 1.5 },
			],
			prio: 1,
		} as never);

		expect(result).toMatchObject({
			category: { id: 1, name: 'Kategorie' },
			group: { id: 4, name: 'Gruppe', private: false },
			orga: 'Orga',
			variables: [
				{ position: 1, type: 'Text', value: 'abc' },
				{ position: 2, type: 'Float', value: 1.5 },
			],
		});
		expect(Object.keys(result)).not.toContain('prio');
	});
});
