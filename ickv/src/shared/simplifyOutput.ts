import type {
	IDataObject,
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

type PostReceive = (
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
) => Promise<INodeExecutionData[]>;

/** The 'Simplify' parameter of an operation whose response has more than 10 fields. */
export function simplifyProperty(show: Record<string, string[]>): INodeProperties {
	return {
		displayName: 'Simplify',
		name: 'simplify',
		type: 'boolean',
		default: true,
		description: 'Whether to return a simplified version of the response instead of the raw data',
		displayOptions: { show },
	};
}

/** Creates a `postReceive` action that maps each response item to its simplified form when 'Simplify' is on. */
export function simplifyOutput<TResponse>(
	simplify: (response: TResponse) => IDataObject,
): PostReceive {
	return async function simplifyItems(items) {
		if (!(this.getNodeParameter('simplify', true) as boolean)) return items;

		return items.map(({ json }) => ({ json: simplify(json as unknown as TResponse) }));
	};
}
