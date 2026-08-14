import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';

const timestamp = '2026-08-14T12:00:00.000Z';
const materialProperty = {
	id: 'property-material',
	inventoryTypeId: 'type-belt',
	name: 'Material',
	normalizedName: 'material',
	kind: 'text' as const,
	required: false,
	minimum: null,
	maximum: null,
	createdAt: timestamp,
	updatedAt: timestamp
};
const widthProperty = {
	id: 'property-width',
	inventoryTypeId: 'type-belt',
	name: 'Width',
	normalizedName: 'width',
	kind: 'numeric' as const,
	required: true,
	minimum: 1,
	maximum: 100,
	createdAt: timestamp,
	updatedAt: timestamp
};
const beltType = {
	id: 'type-belt',
	name: 'Belt',
	normalizedName: 'belt',
	createdAt: timestamp,
	updatedAt: timestamp,
	properties: [materialProperty, widthProperty]
};
const bearingType = {
	id: 'type-bearing',
	name: 'Bearing',
	normalizedName: 'bearing',
	createdAt: timestamp,
	updatedAt: timestamp,
	properties: []
};

const typedPart = {
	id: 'part-typed',
	name: 'Timing belt',
	mfgPartNumber: 'BELT-10',
	description: 'Drive belt',
	metadata: { Material: 'Nylon', Width: 10 },
	inventoryTypeId: 'type-belt',
	inventoryTypeName: 'Belt',
	quantity: 4,
	archivedAt: null,
	updatedAt: timestamp
};
const untypedPart = {
	...typedPart,
	id: 'part-untyped',
	name: 'Legacy part',
	mfgPartNumber: 'LEGACY-1',
	inventoryTypeId: null,
	inventoryTypeName: null,
	metadata: {}
};

function pageData(selected = false) {
	const filters = selected
		? {
				query: 'drive',
				mfgPartNumber: ['BELT-10'],
				id: ['part-typed'],
				showArchived: true,
				typeId: 'type-belt',
				metadataFilters: [
					{
						propertyId: 'property-material',
						operator: 'contains' as const,
						value: 'nyl'
					},
					{ propertyId: 'property-width', operator: 'min' as const, value: 5 }
				]
			}
		: { query: 'legacy', showArchived: false, metadataFilters: [] };

	return {
		databaseConfigured: true,
		databaseReady: true,
		databaseMessage: '',
		query: filters.query,
		showArchived: filters.showArchived,
		inventoryTypes: [bearingType, beltType],
		selectedType: selected ? beltType : null,
		filters,
		facets: selected
			? [{ propertyId: 'property-material', values: [{ value: 'Nylon', count: 2 }] }]
			: [],
		parts: selected ? [typedPart] : [untypedPart],
		history: [],
		isAdmin: false
	};
}

function renderPage(selected = false) {
	return render(Page, { data: pageData(selected), form: null } as never);
}

describe('read-only dashboard metadata filters', () => {
	it('lists inventory types but hides metadata controls until one type is selected', () => {
		renderPage();

		const typeSelect = screen.getByRole('combobox', { name: 'Inventory type' });
		expect(
			within(typeSelect).getAllByRole('option').map((option) => option.textContent?.trim())
		).toEqual(['All types', 'Bearing', 'Belt']);
		expect(screen.queryByRole('group', { name: 'Material filters' })).toBeNull();
		expect(document.querySelectorAll('form[method="GET"]')).toHaveLength(1);
	});

	it('renders accessible text and numeric controls with canonical property-ID query names', () => {
		renderPage(true);

		const typeSelect = screen.getByRole('combobox', { name: 'Inventory type' });
		if (!(typeSelect instanceof HTMLSelectElement)) throw new TypeError('Expected a select element.');
		expect(typeSelect.value).toBe('type-belt');

		const matchMode = screen.getByRole('combobox', { name: 'Material match' });
		const material = screen.getByRole('textbox', { name: 'Material value' });
		if (!(matchMode instanceof HTMLSelectElement)) throw new TypeError('Expected a select element.');
		expect(matchMode.value).toBe('contains');
		expect(material.getAttribute('name')).toBe('meta[property-material][contains]');
		expect((material as HTMLInputElement).value).toBe('nyl');

		for (const [label, operator, value] of [
			['Width exact', 'exact', ''],
			['Width minimum', 'min', '5'],
			['Width maximum', 'max', '']
		] as const) {
			const input = screen.getByRole('spinbutton', { name: label });
			expect(input.getAttribute('name')).toBe(`meta[property-width][${operator}]`);
			expect((input as HTMLInputElement).value).toBe(value);
		}
	});

	it('switches the text input query name between contains and exact modes', async () => {
		renderPage(true);
		const matchMode = screen.getByRole('combobox', { name: 'Material match' });
		const material = screen.getByRole('textbox', { name: 'Material value' });

		await fireEvent.change(matchMode, { target: { value: 'exact' } });

		expect(material.getAttribute('name')).toBe('meta[property-material][exact]');
		expect((material as HTMLInputElement).value).toBe('nyl');
	});

	it('omits empty metadata controls from the serialized GET request', async () => {
		renderPage(true);
		const submit = screen.getByRole('button', { name: 'Apply filters' });
		const filterForm = submit.closest('form');
		if (!filterForm) throw new TypeError('Expected the filter form.');

		await fireEvent.submit(filterForm);

		expect(Object.fromEntries(new FormData(filterForm))).toEqual({
			q: 'drive',
			mfgPartNumber: 'BELT-10',
			id: 'part-typed',
			typeId: 'type-belt',
			showArchived: '1',
			'meta[property-material][contains]': 'nyl',
			'meta[property-width][min]': '5'
		});
	});

	it('builds composable facet and clear-type links and labels legacy rows as Untyped', () => {
		const { rerender } = renderPage(true);
		const facetHref = screen.getByRole('link', { name: 'Nylon (2)' }).getAttribute('href');
		const facetUrl = new URL(facetHref ?? '', 'https://example.test');
		expect(Object.fromEntries(facetUrl.searchParams)).toEqual({
			q: 'drive',
			mfgPartNumber: 'BELT-10',
			id: 'part-typed',
			showArchived: '1',
			typeId: 'type-belt',
			'meta[property-width][min]': '5',
			'meta[property-material][exact]': 'Nylon'
		});

		const clearHref = screen.getByRole('link', { name: 'Clear type' }).getAttribute('href');
		const clearUrl = new URL(clearHref ?? '', 'https://example.test');
		expect(Object.fromEntries(clearUrl.searchParams)).toEqual({
			q: 'drive',
			mfgPartNumber: 'BELT-10',
			id: 'part-typed',
			showArchived: '1'
		});

		rerender({ data: pageData(false), form: null } as never);
		const inventoryTable = screen.getByRole('table', { name: 'Current inventory' });
		expect(within(inventoryTable).getByRole('columnheader', { name: 'Type' })).toBeTruthy();
		expect(within(inventoryTable).getByText('Untyped')).toBeTruthy();
	});
});
