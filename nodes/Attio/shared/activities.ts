import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { z } from 'zod/v4';
import { attioGetAllByCursor } from './request';

const activitySchema = z.object({
	id: z.object({ activity_id: z.string() }),
	api_slug: z.string(),
	singular_noun: z.string(),
});

export type ActivityResponse = z.infer<typeof activitySchema>;

// Activities are in early access, so this fails unless they're enabled for the workspace
export async function getAllActivities(
	context: ILoadOptionsFunctions,
): Promise<ActivityResponse[]> {
	return await attioGetAllByCursor(context, '/activities', activitySchema, 1000);
}
