<script lang="ts">
	let { data } = $props();

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
</script>

<svelte:head>
	<title>Bionic Inventory Backend</title>
	<meta
		name="description"
		content="View current inventory levels and the latest inventory change history."
	/>
</svelte:head>

<div class="container py-4">
	<div class="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center mb-4">
		<div>
			<h1 class="display-6 mb-2">Bionic Inventory Backend</h1>
			<p class="text-body-secondary mb-0">
				View current stock levels and the latest order and consumption activity.
			</p>
		</div>

		<div class="d-flex flex-wrap align-items-center gap-2">
			<a class="btn btn-outline-primary" href="/api">
				<i class="bi bi-book me-1"></i> API Docs
			</a>
			<form class="row g-2 align-items-center m-0" method="GET">
				<div class="col-auto">
					<input
						class="form-control"
						type="search"
						name="q"
						placeholder="Search part name, number, or description"
						value={data.query}
					/>
				</div>
				<div class="col-auto">
					<button class="btn btn-primary" type="submit">Search</button>
				</div>
				{#if data.query}
					<div class="col-auto">
						<a class="btn btn-outline-secondary" href="/">Clear</a>
					</div>
				{/if}
			</form>
		</div>
	</div>

	{#if !data.databaseConfigured || !data.databaseReady}
		<div class="alert alert-warning" role="alert">
			{data.databaseMessage}
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
					<table class="table table-striped table-hover align-middle mb-0">
						<thead>
							<tr>
								<th scope="col">Part</th>
								<th scope="col">MFG Part Number</th>
								<th scope="col">Description</th>
								<th scope="col">Metadata</th>
								<th scope="col" class="text-end">Quantity</th>
							</tr>
						</thead>
						<tbody>
							{#if data.parts.length === 0}
								<tr>
									<td colspan="5" class="text-center py-4 text-body-secondary">
										No parts match the current search.
									</td>
								</tr>
							{:else}
								{#each data.parts as part}
									<tr>
										<td class="fw-semibold">{part.name}</td>
										<td><code>{part.mfgPartNumber}</code></td>
										<td>{part.description || '—'}</td>
										<td class="small text-body-secondary">{formatMetadata(part.metadata)}</td>
										<td class="text-end fw-semibold">{part.quantity}</td>
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
