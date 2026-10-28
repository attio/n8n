import { NodeOperationError, type IExecuteSingleFunctions } from 'n8n-workflow';

// Hand-written because verified community nodes can't ship runtime dependencies
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isUuid(value: string): boolean {
	return uuidPattern.test(value);
}

export function isEmail(value: string): boolean {
	return emailPattern.test(value);
}

export function invalidValueError(
	this: IExecuteSingleFunctions,
	label: string,
	value: string,
	description: string,
): NodeOperationError {
	return new NodeOperationError(this.getNode(), `Invalid ${label} "${value}"`, {
		description,
		itemIndex: this.getItemIndex(),
	});
}
