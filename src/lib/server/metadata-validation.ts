import { InventoryRouteError } from './inventory-errors';

export interface PropertyDefinition {
	id: string;
	name: string;
	normalizedName: string;
	kind: 'text' | 'numeric';
	required: boolean;
	minimum: number | null;
	maximum: number | null;
}

export function canonicalizeAndValidateMetadata(
	metadata: Record<string, unknown>,
	properties: PropertyDefinition[]
): Record<string, unknown> {
	const propertiesByNormalizedName = new Map(
		properties.map((property) => [property.normalizedName, property])
	);
	const canonicalMetadata: Record<string, unknown> = {};
	const seenDefinedKeys = new Set<string>();

	for (const [key, value] of Object.entries(metadata)) {
		const normalizedKey = key.toLocaleLowerCase();
		const property = propertiesByNormalizedName.get(normalizedKey);

		if (!property) {
			setMetadataValue(canonicalMetadata, key, value);
			continue;
		}

		if (seenDefinedKeys.has(property.normalizedName)) {
			throw new InventoryRouteError(
				'METADATA_KEY_COLLISION',
				`metadata contains multiple values for ${property.name}.`,
				400,
				`metadata.${property.normalizedName}`
			);
		}

		seenDefinedKeys.add(property.normalizedName);
		setMetadataValue(canonicalMetadata, property.name, value);
	}

	for (const property of properties) {
		if (!Object.hasOwn(canonicalMetadata, property.name)) {
			if (property.required) {
				throw new InventoryRouteError(
					'METADATA_REQUIRED',
					`${property.name} is required.`,
					400,
					`metadata.${property.name}`
				);
			}
			continue;
		}

		const value = canonicalMetadata[property.name];
		if (property.kind === 'text') {
			if (typeof value !== 'string') {
				throw new InventoryRouteError(
					'METADATA_INVALID_TYPE',
					`${property.name} must be a string.`,
					400,
					`metadata.${property.name}`
				);
			}
			if (property.required && value.trim().length === 0) {
				throw new InventoryRouteError(
					'METADATA_REQUIRED',
					`${property.name} is required.`,
					400,
					`metadata.${property.name}`
				);
			}
			continue;
		}

		if (typeof value !== 'number' || !Number.isFinite(value)) {
			throw new InventoryRouteError(
				'METADATA_INVALID_TYPE',
				`${property.name} must be a finite number.`,
				400,
				`metadata.${property.name}`
			);
		}

		if (property.minimum !== null && value < property.minimum) {
			throw new InventoryRouteError(
				'METADATA_OUT_OF_RANGE',
				`${property.name} must be at least ${property.minimum}.`,
				400,
				`metadata.${property.name}`
			);
		}
		if (property.maximum !== null && value > property.maximum) {
			throw new InventoryRouteError(
				'METADATA_OUT_OF_RANGE',
				`${property.name} must be at most ${property.maximum}.`,
				400,
				`metadata.${property.name}`
			);
		}
	}

	return canonicalMetadata;
}

function setMetadataValue(metadata: Record<string, unknown>, key: string, value: unknown): void {
	Object.defineProperty(metadata, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true
	});
}
