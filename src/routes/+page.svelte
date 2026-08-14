<script lang="ts">
	import { untrack } from 'svelte';

	let { data, form } = $props();
	type TextOperator = 'exact' | 'contains';
	const numericFilterControls = [
		{ operator: 'exact', label: 'exact' },
		{ operator: 'min', label: 'minimum' },
		{ operator: 'max', label: 'maximum' }
	] as const;

	function incomingTextOperators(): Record<string, TextOperator> {
		return Object.fromEntries(
			(data.selectedType?.properties ?? [])
				.filter((property) => property.kind === 'text')
				.map((property) => {
					const active = data.filters.metadataFilters.find(
						(filter) => filter.propertyId === property.id
					);
					return [property.id, active?.operator === 'contains' ? 'contains' : 'exact'];
				})
		);
	}

	function incomingTextValues(): Record<string, string> {
		return Object.fromEntries(
			(data.selectedType?.properties ?? [])
				.filter((property) => property.kind === 'text')
				.map((property) => {
					const active = data.filters.metadataFilters.find(
						(filter) =>
							filter.propertyId === property.id &&
							(filter.operator === 'exact' || filter.operator === 'contains')
					);
					return [property.id, active === undefined ? '' : String(active.value)];
				})
		);
	}

	let textOperators = $state<Record<string, TextOperator>>(untrack(incomingTextOperators));
	let textValues = $state<Record<string, string>>(untrack(incomingTextValues));

	$effect.pre(() => {
		textOperators = incomingTextOperators();
		textValues = incomingTextValues();
	});

	function totalQuantity() {
		return data.parts.reduce((sum, part) => sum + part.quantity, 0);
	}

	function outOfStockParts() {
		return data.parts.filter((part) => part.quantity <= 0).length;
	}

	function formatMetadata(metadata: Record<string, unknown>) {
		const entries = Object.entries(metadata);
		return entries.length > 0 ? entries.map(([key, value]) => `${key}: ${value}`).join(', ') : '—';
	}

	function formatTimestamp(timestamp: string) {
		return new Date(timestamp).toLocaleString();
	}

	function filterValue(propertyId: string, operator: 'exact' | 'contains' | 'min' | 'max') {
		const value = data.filters.metadataFilters.find(
			(filter) => filter.propertyId === propertyId && filter.operator === operator
		)?.value;
		return value === undefined ? '' : String(value);
	}

	function facetValues(propertyId: string) {
		return data.facets.find((facet) => facet.propertyId === propertyId)?.values ?? [];
	}

	function filterParams(options: {
		includeType?: boolean;
		includeMetadata?: boolean;
		excludePropertyId?: string;
	} = {}) {
		const params = new URLSearchParams();
		if (data.filters.query) params.set('q', data.filters.query);
		for (const value of data.filters.mfgPartNumber ?? []) params.append('mfgPartNumber', value);
		for (const value of data.filters.id ?? []) params.append('id', value);
		if (data.filters.showArchived) params.set('showArchived', '1');
		if (options.includeType !== false && data.filters.typeId) {
			params.set('typeId', data.filters.typeId);
		}
		if (options.includeMetadata !== false) {
			for (const filter of data.filters.metadataFilters) {
				if (filter.propertyId === options.excludePropertyId) continue;
				params.set(`meta[${filter.propertyId}][${filter.operator}]`, String(filter.value));
			}
		}
		return params;
	}

	function hrefFromParams(params: URLSearchParams) {
		const query = params.toString();
		return query ? `/?${query}` : '/';
	}

	function facetHref(propertyId: string, value: string) {
		const params = filterParams({ excludePropertyId: propertyId });
		params.set(`meta[${propertyId}][exact]`, value);
		return hrefFromParams(params);
	}

	function clearTypeHref() {
		return hrefFromParams(filterParams({ includeType: false, includeMetadata: false }));
	}

	function handleFilterSubmit(event: SubmitEvent) {
		const filterForm = event.currentTarget as HTMLFormElement;
		const typeSelect = filterForm.elements.namedItem('typeId');
		const metadataInputs = filterForm.querySelectorAll<HTMLInputElement>('input[name^="meta["]');
		for (const input of metadataInputs) {
			if (
				!(typeSelect instanceof HTMLSelectElement) ||
				!typeSelect.value ||
				(input.dataset.metadataControl === 'true' && !input.value)
			) {
				input.disabled = true;
			}
		}
	}
</script>

<svelte:head>
	<title>Bionic Inventory Backend</title>
	<meta
		name="description"
		content="View current inventory levels and the latest inventory change history."
	/>
</svelte:head>

<div class="container py-4">
	<div class="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center mb-3">
		<div>
			<h1 class="display-6 mb-2">Bionic Inventory Backend</h1>
			<p class="text-body-secondary mb-0">
				View current stock levels and the latest order and consumption activity.
			</p>
		</div>

		<a class="btn btn-outline-primary align-self-start" href="/api">
			<i class="bi bi-book me-1"></i> API Docs
		</a>
	</div>

	<form class="card card-body shadow-sm mb-4" method="GET" onsubmit={handleFilterSubmit}>
		{#each data.filters.mfgPartNumber ?? [] as mfgPartNumber}
			<input type="hidden" name="mfgPartNumber" value={mfgPartNumber} />
		{/each}
		{#each data.filters.id ?? [] as id}
			<input type="hidden" name="id" value={id} />
		{/each}
		{#if !data.selectedType}
			{#each data.filters.metadataFilters as filter}
				<input
					type="hidden"
					name={`meta[${filter.propertyId}][${filter.operator}]`}
					value={filter.value}
				/>
			{/each}
		{/if}
		<div class="row g-3 align-items-end">
			<div class="col-lg-6">
				<label class="form-label" for="inventory-search">Search inventory</label>
				<input
					class="form-control"
					type="search"
					id="inventory-search"
					name="q"
					placeholder="Search part name, number, or description"
					value={data.query}
				/>
			</div>
			<div class="col-md-6 col-lg-4">
				<label class="form-label" for="inventory-type">Inventory type</label>
				<select
					class="form-select"
					id="inventory-type"
					name="typeId"
					value={data.filters.typeId ?? ''}
				>
					<option value="">All types</option>
					{#each data.inventoryTypes as inventoryType}
						<option value={inventoryType.id}>{inventoryType.name}</option>
					{/each}
					{#if data.filters.typeId && !data.inventoryTypes.some((inventoryType) => inventoryType.id === data.filters.typeId)}
						<option value={data.filters.typeId}>Unavailable type ({data.filters.typeId})</option>
					{/if}
				</select>
			</div>
			<div class="col-md-6 col-lg-2">
				<div class="form-check mb-2">
					<input
						class="form-check-input"
						type="checkbox"
						id="showArchived"
						name="showArchived"
						value="1"
						checked={data.showArchived}
					/>
					<label class="form-check-label" for="showArchived">Show archived</label>
				</div>
			</div>
		</div>

		{#if data.selectedType}
			<hr />
			<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
				<h2 class="h6 mb-0">{data.selectedType.name} metadata</h2>
				<a class="btn btn-sm btn-outline-secondary" href={clearTypeHref()}>Clear type</a>
			</div>
			<div class="row g-3">
				{#each data.selectedType.properties as property}
					<div class="col-lg-6">
						<fieldset class="border rounded p-3 h-100" aria-label={`${property.name} filters`}>
							<legend class="float-none w-auto px-1 fs-6">{property.name}</legend>
							{#if property.kind === 'text'}
								<div class="row g-2">
									<div class="col-sm-4">
										<label class="form-label" for={`metadata-mode-${property.id}`}>
											{property.name} match
										</label>
										<select
											class="form-select"
											id={`metadata-mode-${property.id}`}
											bind:value={textOperators[property.id]}
										>
											<option value="exact">Exact</option>
											<option value="contains">Contains</option>
										</select>
									</div>
									<div class="col-sm-8">
										<label class="form-label" for={`metadata-value-${property.id}`}>
											{property.name} value
										</label>
										<input
											class="form-control"
											type="text"
											id={`metadata-value-${property.id}`}
											name={`meta[${property.id}][${textOperators[property.id]}]`}
											data-metadata-control="true"
											bind:value={textValues[property.id]}
										/>
									</div>
								</div>
								{#if facetValues(property.id).length > 0}
									<div class="d-flex flex-wrap gap-2 mt-3" aria-label={`${property.name} values`}>
										{#each facetValues(property.id) as facet}
											<a class="btn btn-sm btn-outline-primary" href={facetHref(property.id, facet.value)}>
												{facet.value} ({facet.count})
											</a>
										{/each}
									</div>
								{/if}
							{:else}
								<div class="row g-2">
									{#each numericFilterControls as { operator, label }}
										<div class="col-sm-4">
											<label class="form-label" for={`metadata-${operator}-${property.id}`}>
												{property.name} {label}
											</label>
											<input
												class="form-control"
												type="number"
												step="any"
												id={`metadata-${operator}-${property.id}`}
												name={`meta[${property.id}][${operator}]`}
												data-metadata-control="true"
												value={filterValue(property.id, operator)}
											/>
										</div>
									{/each}
								</div>
							{/if}
						</fieldset>
					</div>
				{/each}
			</div>
		{/if}

		<div class="d-flex flex-wrap gap-2 mt-3">
			<button class="btn btn-primary" type="submit">Apply filters</button>
			{#if data.query || data.showArchived || data.selectedType}
				<a class="btn btn-outline-secondary" href="/">Clear all</a>
			{/if}
		</div>
	</form>

	{#if !data.databaseConfigured || !data.databaseReady}
		<div class="alert alert-warning" role="alert">
			{data.databaseMessage}
		</div>
	{/if}

	{#if form?.archiveError}
		<div class="alert alert-danger" role="alert">
			{form.archiveError}
		</div>
	{/if}

	<div class="row g-3 mb-4">
		<div class="col-md-4">
			<div class="card h-100 shadow-sm">
				<div class="card-body">
					<p class="text-uppercase text-body-secondary small mb-2">Tracked parts</p>
					<p class="display-6 mb-0">{data.parts.length}</p>
				</div>
			</div>
		</div>
		<div class="col-md-4">
			<div class="card h-100 shadow-sm">
				<div class="card-body">
					<p class="text-uppercase text-body-secondary small mb-2">Inventory on hand</p>
					<p class="display-6 mb-0">{totalQuantity()}</p>
				</div>
			</div>
		</div>
		<div class="col-md-4">
			<div class="card h-100 shadow-sm">
				<div class="card-body">
					<p class="text-uppercase text-body-secondary small mb-2">Out of stock / negative</p>
					<p class="display-6 mb-0">{outOfStockParts()}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="row g-4">
		<div class="col-12">
			<div class="card shadow-sm">
				<div class="card-header bg-body-tertiary">
					<h2 class="h5 mb-0">Current inventory</h2>
				</div>
				<div class="table-responsive">
					<table class="table table-striped table-hover align-middle mb-0" aria-label="Current inventory">
						<thead>
							<tr>
								<th scope="col">Part</th>
								<th scope="col">Type</th>
								<th scope="col">MFG Part Number</th>
								<th scope="col">Description</th>
								<th scope="col">Metadata</th>
								<th scope="col" class="text-end">Quantity</th>
								{#if data.isAdmin}
									<th scope="col" class="text-end">Action</th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#if data.parts.length === 0}
								<tr>
									<td colspan={data.isAdmin ? 7 : 6} class="text-center py-4 text-body-secondary">
										No parts match the current search.
									</td>
								</tr>
							{:else}
								{#each data.parts as part}
									<tr class:table-light={part.archivedAt}>
										<td class="fw-semibold">
											{part.name}
											{#if part.archivedAt}
												<span class="badge bg-secondary ms-2">Archived</span>
											{/if}
										</td>
										<td>{part.inventoryTypeName ?? 'Untyped'}</td>
										<td><code>{part.mfgPartNumber}</code></td>
										<td>{part.description || '—'}</td>
										<td class="small text-body-secondary">{formatMetadata(part.metadata)}</td>
										<td class="text-end fw-semibold">{part.quantity}</td>
										{#if data.isAdmin}
											<td class="text-end">
												{#if part.archivedAt}
													<form method="POST" action="?/unarchive" style="display: inline;">
														<input type="hidden" name="id" value={part.id} />
														<button type="submit" class="btn btn-outline-secondary btn-sm">
															Unarchive
														</button>
													</form>
												{:else}
													<form method="POST" action="?/archive" style="display: inline;">
														<input type="hidden" name="id" value={part.id} />
														<button type="submit" class="btn btn-outline-danger btn-sm">
															Archive
														</button>
													</form>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<div class="col-12">
			<div class="card shadow-sm">
				<div class="card-header bg-body-tertiary">
					<h2 class="h5 mb-0">Recent history</h2>
				</div>
				<div class="table-responsive">
					<table class="table table-sm table-striped align-middle mb-0">
						<thead>
							<tr>
								<th scope="col">When</th>
								<th scope="col">Actor</th>
								<th scope="col">Part</th>
								<th scope="col">Delta</th>
								<th scope="col">Used In</th>
								<th scope="col">Note</th>
								<th scope="col">Transaction</th>
							</tr>
						</thead>
						<tbody>
							{#if data.history.length === 0}
								<tr>
									<td colspan="7" class="text-center py-4 text-body-secondary">
										No inventory activity has been recorded yet.
									</td>
								</tr>
							{:else}
								{#each data.history as entry}
									<tr>
										<td>{formatTimestamp(entry.recordedAt)}</td>
										<td>{entry.actor}</td>
										<td>
											<div class="fw-semibold">{entry.partName}</div>
											<div class="small text-body-secondary">{entry.mfgPartNumber}</div>
										</td>
										<td class:table-danger={entry.quantityDelta < 0} class:table-success={entry.quantityDelta > 0}>
											{entry.quantityDelta > 0 ? `+${entry.quantityDelta}` : entry.quantityDelta}
										</td>
										<td>{entry.usedIn ?? '—'}</td>
										<td>{entry.note ?? '—'}</td>
										<td><code>{entry.transactionId}</code></td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>
</div>
