import type {
	ILoadOptionsFunctions,
	INodeListSearchResult,
	ResourceMapperFields,
} from 'n8n-workflow';
import { getListParentObject } from '../../shared/lists';
import { searchObjectRecords } from '../../shared/recordSearch';
import { getAttributeFields } from '../record/attributes';

export async function getListEntryAttributes(
	this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
	const list = this.getNodeParameter('list', '') as string;
	if (!list) {
		return { fields: [], emptyFieldsNotice: 'Choose a list to see its attributes' };
	}

	const result = await getAttributeFields.call(
		this,
		`/lists/${encodeURIComponent(list)}/attributes`,
	);

	// A load error already comes with its own notice
	if (result.fields.length === 0 && !result.emptyFieldsNotice) {
		result.emptyFieldsNotice =
			'This list has no attributes that can be set, so records are added to it without entry values. Add attributes to the list in Attio, then refresh, to set them here.';
	}

	return result;
}

// Searches all records of the list's object, not just those already in the list
export async function searchListParentRecords(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const list = this.getCurrentNodeParameter('list') as string | undefined;
	if (!list) return { results: [] };

	// Fails for legacy lists, which Create can't add records to either
	const object = await getListParentObject(this, list);

	return await searchObjectRecords(this, object, filter);
}
