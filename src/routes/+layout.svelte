<script lang="ts">
	import 'bootstrap/dist/css/bootstrap.min.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="navbar navbar-expand navbar-dark bg-dark shadow-sm">
	<div class="container">
		<a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="/">
			<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" class="bi bi-box-seam-fill text-primary" viewBox="0 0 16 16">
				<path fill-rule="evenodd" d="M15.528 3.673a1 1 0 0 1 .472.847v7.96a1 1 0 0 1-.472.847l-7 3.889a1 1 0 0 1-.956 0l-7-3.889A1 1 0 0 1 0 12.48V4.52a1 1 0 0 1 .472-.847l7-3.889a1 1 0 0 1 .956 0l7 3.889zm-1.333 1.022L8 8.167 1.805 4.695 8 1.25l6.195 3.445z"/>
			</svg>
			Bionic Inventory
		</a>

		<div class="navbar-nav ms-auto flex-row gap-3 align-items-center">
			<a class="nav-link px-2" href="/">Inventory</a>
			{#if data.isAdmin}
				<a class="nav-link px-2" href="/keys">API Keys</a>
				<form method="POST" action="/login?/logout">
					<button class="btn btn-link nav-link px-2" type="submit">Logout</button>
				</form>
			{:else}
				<a class="nav-link px-2" href="/login">Login</a>
			{/if}
		</div>
	</div>
</nav>

<main>
	{@render children()}
</main>
