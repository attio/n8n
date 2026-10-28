import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { attioGetAllByCursor, isObject } from './request';

export type ActivityResponse = {
	id: { activity_id: string };
	api_slug: string;
	singular_noun: string;
};

function isActivityResponse(value: unknown): value is ActivityResponse {
	return (
		isObject(value) &&
		isObject(value.id) &&
		typeof value.id.activity_id === 'string' &&
		typeof value.api_slug === 'string' &&
		typeof value.singular_noun === 'string'
	);
}

// Activities are in early access, so this fails unless they're enabled for the workspace
export async function getAllActivities(context: ILoadOptionsFunctions): Promise<ActivityResponse[]> {
	return await attioGetAllByCursor(context, '/activities', isActivityResponse, 1000);
}
