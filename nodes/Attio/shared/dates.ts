import { NodeOperationError, type IExecuteSingleFunctions } from 'n8n-workflow';

export function toIsoDate(this: IExecuteSingleFunctions, value: string, label: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new NodeOperationError(this.getNode(), `Invalid ${label} "${value}"`, {
			description: 'Use an ISO 8601 date, for example 2026-10-03T15:00:00Z',
			itemIndex: this.getItemIndex(),
		});
	}

	return date.toISOString();
}
