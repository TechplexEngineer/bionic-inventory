<script lang="ts">
	let { data, form } = $props();

	let copied = $state(false);

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 3000);
	}

	function formatTimestamp(timestamp: string) {
		return new Date(timestamp).toLocaleString();
	}
</script>

<svelte:head>
	<title>API Keys - Bionic Inventory</title>
</svelte:head>

<div class="container py-4">
	<div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
		<div>
			<h1 class="display-6 mb-1">API Key Provisioning</h1>
			<p class="text-body-secondary mb-0">Create and manage access tokens for producers and consumers.</p>
		</div>
	</div>

	{#if data.databaseMessage}
		<div class="alert alert-warning mb-4" role="alert">
			{data.databaseMessage}
		</div>
	{/if}

	{#if form?.createdKey}
		<div class="alert alert-success shadow-sm p-4 mb-4 border-success border-2 rounded-3" role="alert">
			<div class="d-flex align-items-center mb-2">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-check-circle-fill me-2" viewBox="0 0 16 16">
					<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.018-1.042z"/>
				</svg>
				<h4 class="alert-heading h5 mb-0 fw-bold">API Key Created Successfully</h4>
			</div>
			<p class="mb-3 text-secondary-emphasis">Please copy this API key now. Pass it in your API requests using the <code>Authorization: Bearer &lt;token&gt;</code> or <code>X-API-Token: &lt;token&gt;</code> header.</p>

			<div class="input-group">
				<input type="text" class="form-control font-monospace fw-bold" readonly value={form.createdKey.token} />
				<button class="btn btn-success fw-semibold" type="button" onclick={() => copyToClipboard(form.createdKey.token)}>
					{copied ? 'Copied!' : 'Copy Key'}
				</button>
			</div>
		</div>
	{/if}

	{#if form?.createError}
		<div class="alert alert-danger mb-4" role="alert">
			{form.createError}
		</div>
	{/if}

	{#if form?.revokeError}
		<div class="alert alert-danger mb-4" role="alert">
			{form.revokeError}
		</div>
	{/if}

	<div class="row g-4 mb-4">
		<div class="col-lg-5">
			<div class="card shadow-sm h-100">
				<div class="card-header bg-body-tertiary">
					<h2 class="h5 mb-0 fw-semibold">Generate New API Key</h2>
				</div>
				<div class="card-body">
					<form method="POST" action="?/create">
						<div class="mb-3">
							<label for="keyName" class="form-label fw-medium">Key Name / Client Identifier</label>
							<input
								type="text"
								class="form-control"
								id="keyName"
								name="name"
								placeholder="e.g., Warehouse Scanner 1"
								required
							/>
						</div>

						<div class="mb-4">
							<label for="keyRole" class="form-label fw-medium">API Role / Permissions</label>
							<select class="form-select" id="keyRole" name="role" required>
								<option value="producer">Producer (Read & Write)</option>
								<option value="consumer">Consumer (Read-Only)</option>
							</select>
							<div class="form-text">
								<strong>Producer:</strong> can record transactions and add parts.<br />
								<strong>Consumer:</strong> can query inventory levels and history.
							</div>
						</div>

						<button type="submit" class="btn btn-primary w-100 fw-semibold">
							Create API Key
						</button>
					</form>
				</div>
			</div>
		</div>

		<div class="col-lg-7">
			<div class="card shadow-sm h-100">
				<div class="card-header bg-body-tertiary">
					<h2 class="h5 mb-0 fw-semibold">Existing API Keys</h2>
				</div>
				<div class="table-responsive">
					<table class="table table-hover align-middle mb-0">
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Role</th>
								<th scope="col">Key Prefix</th>
								<th scope="col">Created</th>
								<th scope="col">Status</th>
								<th scope="col" class="text-end">Action</th>
							</tr>
						</thead>
						<tbody>
							{#if data.keys.length === 0}
								<tr>
									<td colspan="6" class="text-center py-4 text-body-secondary">
										No API keys have been created yet.
									</td>
								</tr>
							{:else}
								{#each data.keys as apiKey}
									<tr class:table-light={apiKey.revokedAt}>
										<td class="fw-semibold">{apiKey.name}</td>
										<td>
											<span class="badge" class:bg-primary={apiKey.role === 'producer'} class:bg-info={apiKey.role === 'consumer'}>
												{apiKey.role}
											</span>
										</td>
										<td>
											<code>{apiKey.keyPrefix}</code>
										</td>
										<td class="small text-body-secondary">{formatTimestamp(apiKey.createdAt)}</td>
										<td>
											{#if apiKey.revokedAt}
												<span class="badge bg-secondary">Revoked</span>
											{:else}
												<span class="badge bg-success">Active</span>
											{/if}
										</td>
										<td class="text-end">
											{#if !apiKey.revokedAt}
												<form method="POST" action="?/revoke" style="display: inline;">
													<input type="hidden" name="id" value={apiKey.id} />
													<button type="submit" class="btn btn-outline-danger btn-sm">
														Revoke
													</button>
												</form>
											{:else}
												<span class="text-body-secondary small">—</span>
											{/if}
										</td>
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
