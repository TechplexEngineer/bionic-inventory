import { describe, expect, it } from 'vitest';
import { InventoryRouteError, handleInventoryError } from './inventory-errors';
import {
	canonicalizeAndValidateMetadata,
	type PropertyDefinition
} from './metadata-validation';

const properties: PropertyDefinition[] = [
	{
		id: 'width',
		name: 'Width',
		normalizedName: 'width',
		kind: 'numeric',
		required: true,
		minimum: 10,
		maximum: 20
	},
	{
		id: 'finish',
		name: 'Finish',
		normalizedName: 'finish',
		kind: 'text',
		required: false,
		minimum: null,
		maximum: null
	}
];

describe('canonicalizeAndValidateMetadata', () => {
	it('canonicalizes defined keys while preserving undefined keys exactly', () => {
		expect(
			canonicalizeAndValidateMetadata(
				{ WIDTH: 10, VendorCode: 'A7' },
				properties
			)
		).toEqual({ Width: 10, VendorCode: 'A7' });
	});

	it('preserves an undefined __proto__ key as metadata without changing the result prototype', () => {
		const metadata = JSON.parse('{"Width":10,"__proto__":{"poisoned":true}}') as Record<
			string,
			unknown
		>;
		const result = canonicalizeAndValidateMetadata(metadata, properties);

		expect(Object.hasOwn(result, '__proto__')).toBe(true);
		expect(result.__proto__).toEqual({ poisoned: true });
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
	});

	it('rejects duplicate keys that collapse to one defined property', () => {
		expect(() =>
			canonicalizeAndValidateMetadata({ Width: 10, width: 11 }, properties)
		).toThrowError(
			expect.objectContaining({ code: 'METADATA_KEY_COLLISION', field: 'metadata.width' })
		);
	});

	it('rejects required whitespace-only text', () => {
		const requiredText: PropertyDefinition[] = [
			{
				id: 'material',
				name: 'Material',
				normalizedName: 'material',
				kind: 'text',
				required: true,
				minimum: null,
				maximum: null
			}
		];

		expect(() =>
			canonicalizeAndValidateMetadata({ material: ' \t ' }, requiredText)
		).toThrowError(
			expect.objectContaining({ code: 'METADATA_REQUIRED', field: 'metadata.Material' })
		);
	});

	it('allows optional defined properties to be absent', () => {
		expect(canonicalizeAndValidateMetadata({ Width: 10 }, properties)).toEqual({ Width: 10 });
	});

	it('rejects supplied values with the wrong JSON kind', () => {
		expect(() =>
			canonicalizeAndValidateMetadata({ Width: '10' }, properties)
		).toThrowError(
			expect.objectContaining({ code: 'METADATA_INVALID_TYPE', field: 'metadata.Width' })
		);

		expect(() =>
			canonicalizeAndValidateMetadata({ Width: 10, Finish: ['matte'] }, properties)
		).toThrowError(
			expect.objectContaining({ code: 'METADATA_INVALID_TYPE', field: 'metadata.Finish' })
		);
	});

	it('rejects non-finite numeric values', () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			expect(() => canonicalizeAndValidateMetadata({ Width: value }, properties)).toThrowError(
				expect.objectContaining({ code: 'METADATA_INVALID_TYPE', field: 'metadata.Width' })
			);
		}
	});

	it('accepts inclusive numeric bounds and rejects values outside them', () => {
		expect(canonicalizeAndValidateMetadata({ Width: 10 }, properties)).toEqual({ Width: 10 });
		expect(canonicalizeAndValidateMetadata({ Width: 20 }, properties)).toEqual({ Width: 20 });

		expect(() => canonicalizeAndValidateMetadata({ Width: 9.99 }, properties)).toThrowError(
			expect.objectContaining({ code: 'METADATA_OUT_OF_RANGE', field: 'metadata.Width' })
	);
		expect(() => canonicalizeAndValidateMetadata({ Width: 20.01 }, properties)).toThrowError(
			expect.objectContaining({ code: 'METADATA_OUT_OF_RANGE', field: 'metadata.Width' })
	);
	});
});

describe('handleInventoryError', () => {
	it('keeps the error message while adding structured error fields', async () => {
		const response = handleInventoryError(
			new InventoryRouteError('METADATA_REQUIRED', 'Material is required.', 400, 'metadata.Material')
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Material is required.',
			code: 'METADATA_REQUIRED',
			field: 'metadata.Material'
		});
	});

	it('maps malformed JSON to its stable structured error response', async () => {
		const response = handleInventoryError(new SyntaxError('Unexpected token'));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Request body must be valid JSON.',
			code: 'INVALID_JSON'
		});
	});
});
