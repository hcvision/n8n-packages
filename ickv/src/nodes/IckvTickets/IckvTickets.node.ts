import { IckvTicketsGeneratedNode } from './IckvTickets.generated.node';
import { resourceProperties } from './resources';

/** Handwritten node: metadata and connection settings come from the generated base class. */
export class IckvTickets extends IckvTicketsGeneratedNode {
	constructor() {
		super(resourceProperties);
	}
}
