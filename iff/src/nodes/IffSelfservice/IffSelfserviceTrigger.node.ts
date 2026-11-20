import { IffSelfserviceTriggerGeneratedNode } from './IffSelfserviceTrigger.generated.node';

/** Handwritten node: connection settings and webhook handling come from the generated base class. */
export class IffSelfserviceTrigger extends IffSelfserviceTriggerGeneratedNode {
	constructor() {
		super([
			{
				name: 'Form Completed',
				value: 'hcv:iff:form:completed',
				description: 'Triggers when a form has been completed',
				action: 'On form completed',
			},
		]);
	}
}
