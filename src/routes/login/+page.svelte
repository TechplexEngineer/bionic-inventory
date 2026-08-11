<script lang="ts">
	let { form } = $props();
</script>

<svelte:head>
	<title>Admin Login - Bionic Inventory</title>
</svelte:head>

<div class="container py-5" style="max-width: 480px;">
	<div class="card shadow-lg border-0 rounded-3">
		<div class="card-body p-4 p-md-5">
			<div class="text-center mb-4">
				<div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 56px; height: 56px;">
					<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="currentColor" class="bi bi-shield-lock-fill" viewBox="0 0 16 16">
						<path fill-rule="evenodd" d="M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.465 9.99a11.8 11.8 0 0 0 4.132 3.211.93.93 0 0 0 .524 0 11.8 11.8 0 0 0 4.132-3.211c1.678-2.195 3.061-5.513 2.465-9.99a1.54 1.54 0 0 0-1.044-1.263 63 63 0 0 0-2.887-.87C9.843.266 8.69 0 8 0m0 5a1.5 1.5 0 0 1 .5 2.915.5.5 0 0 1-.5.5v1.5a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 .5-.5A1.5 1.5 0 0 1 8 5"/>
					</svg>
				</div>
				<h2 class="h3 fw-bold mb-1">Admin Authorization</h2>
				<p class="text-body-secondary small mb-0">Enter the environment administrator password to manage API keys.</p>
			</div>

			{#if form?.error}
				<div class="alert alert-danger d-flex align-items-center" role="alert">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill me-2 flex-shrink-0" viewBox="0 0 16 16">
						<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
					</svg>
					<div>{form.error}</div>
				</div>
			{/if}

			<form method="POST" action="?/login">
				<div class="mb-4">
					<label for="passwordInput" class="form-label fw-semibold">Admin Password</label>
					<input
						type="password"
						class="form-control form-control-lg"
						id="passwordInput"
						name="password"
						placeholder="••••••••"
						required
						autocomplete="current-password"
					/>
					<div class="form-text">
						Password specified by <code>ADMIN_PASSWORD</code> environment variable.
					</div>
				</div>

				<button type="submit" class="btn btn-primary btn-lg w-100 fw-semibold">
					Log In
				</button>
			</form>
		</div>
	</div>
</div>
