import type { ApiDocumentation, ApiEndpointDoc } from './api-docs';

export function renderApiDocHtml(docs: ApiDocumentation): string {
	const endpointsJson = JSON.stringify(docs.endpoints);

	return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${docs.title} Documentation</title>
	<meta name="description" content="${docs.description}" />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
	<style>
		:root {
			--bg-dark-accent: #0f172a;
			--card-bg: #1e293b;
			--border-color: #334155;
			--primary-glow: #6366f1;
		}

		body {
			background-color: var(--bg-dark-accent);
			color: #f8fafc;
			font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
		}

		.navbar-brand-gradient {
			background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			font-weight: 700;
		}

		.hero-section {
			background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
			border-bottom: 1px solid var(--border-color);
			padding: 3rem 0 2.5rem 0;
		}

		.sidebar-sticky {
			position: sticky;
			top: 2rem;
		}

		.nav-link-custom {
			color: #94a3b8;
			border-left: 2px solid transparent;
			padding: 0.4rem 1rem;
			font-size: 0.9rem;
			transition: all 0.2s ease;
			text-decoration: none;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.nav-link-custom:hover, .nav-link-custom.active {
			color: #ffffff;
			border-left-color: #6366f1;
			background-color: rgba(99, 102, 241, 0.08);
			border-radius: 0 4px 4px 0;
		}

		.badge-method-get {
			background-color: rgba(16, 185, 129, 0.2);
			color: #34d399;
			border: 1px solid rgba(16, 185, 129, 0.4);
			font-weight: 700;
		}

		.badge-method-post {
			background-color: rgba(99, 102, 241, 0.2);
			color: #818cf8;
			border: 1px solid rgba(99, 102, 241, 0.4);
			font-weight: 700;
		}

		.badge-role-producer {
			background-color: rgba(245, 158, 11, 0.15);
			color: #fbbf24;
			border: 1px solid rgba(245, 158, 11, 0.3);
		}

		.badge-role-consumer {
			background-color: rgba(14, 165, 233, 0.15);
			color: #38bdf8;
			border: 1px solid rgba(14, 165, 233, 0.3);
		}

		.card-endpoint {
			background-color: var(--card-bg);
			border: 1px solid var(--border-color);
			border-radius: 10px;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
			margin-bottom: 2rem;
			overflow: hidden;
			transition: border-color 0.2s ease;
		}

		.card-endpoint:hover {
			border-color: #475569;
		}

		.card-endpoint-header {
			background-color: rgba(15, 23, 42, 0.6);
			border-bottom: 1px solid var(--border-color);
			padding: 1.25rem 1.5rem;
		}

		pre.code-block {
			background-color: #090d16;
			border: 1px solid #1e293b;
			border-radius: 6px;
			padding: 1rem;
			color: #e2e8f0;
			font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
			font-size: 0.875rem;
			overflow-x: auto;
			position: relative;
			margin-bottom: 0;
		}

		.btn-copy {
			position: absolute;
			top: 0.5rem;
			right: 0.5rem;
			font-size: 0.75rem;
			padding: 0.25rem 0.6rem;
			opacity: 0.8;
			transition: opacity 0.2s;
		}

		.btn-copy:hover {
			opacity: 1;
		}

		.table-dark-custom {
			--bs-table-bg: transparent;
			--bs-table-border-color: var(--border-color);
			color: #cbd5e1;
		}

		.try-out-box {
			background-color: #0f172a;
			border: 1px dashed var(--border-color);
			border-radius: 8px;
			padding: 1.25rem;
			margin-top: 1.5rem;
		}
	</style>
</head>
<body>

	<!-- Top Navigation -->
	<nav class="navbar navbar-expand-lg border-bottom border-secondary-subtle bg-dark sticky-top py-2">
		<div class="container-fluid px-4">
			<a class="navbar-brand d-flex align-items-center gap-2" href="/">
				<i class="bi bi-cpu-fill text-indigo fs-4" style="color: #818cf8;"></i>
				<span class="navbar-brand-gradient fs-4">${docs.title}</span>
				<span class="badge bg-indigo-subtle text-indigo border border-indigo-subtle small ms-2" style="background: rgba(99,102,241,0.2); color: #a5b4fc; border-color: rgba(99,102,241,0.4);">v${docs.version}</span>
			</a>
			<div class="d-flex align-items-center gap-3">
				<a href="/api?format=json" class="btn btn-outline-light btn-sm d-flex align-items-center gap-2" target="_blank" id="download-json-btn">
					<i class="bi bi-filetype-json"></i> OpenAPI JSON
				</a>
				<a href="/" class="btn btn-primary btn-sm d-flex align-items-center gap-2" id="back-to-app-btn">
					<i class="bi bi-house-door"></i> Back to Dashboard
				</a>
			</div>
		</div>
	</nav>

	<!-- Hero Header -->
	<header class="hero-section text-center">
		<div class="container px-4">
			<h1 class="display-5 fw-bold mb-3">API Documentation & Reference</h1>
			<p class="lead text-secondary mx-auto mb-4" style="max-width: 750px;">
				${docs.description}
			</p>
			<div class="d-flex flex-wrap justify-content-center gap-3">
				<div class="bg-dark bg-opacity-50 border border-secondary-subtle px-3 py-2 rounded-3 text-start">
					<div class="small text-secondary text-uppercase fw-semibold">Base URL</div>
					<code class="fs-6 text-indigo" style="color: #818cf8;">${docs.baseUrl}</code>
				</div>
				<div class="bg-dark bg-opacity-50 border border-secondary-subtle px-3 py-2 rounded-3 text-start">
					<div class="small text-secondary text-uppercase fw-semibold">Auth Header</div>
					<code class="fs-6 text-light">x-api-token: &lt;token&gt;</code>
				</div>
				<div class="bg-dark bg-opacity-50 border border-secondary-subtle px-3 py-2 rounded-3 text-start">
					<div class="small text-secondary text-uppercase fw-semibold">Endpoints</div>
					<span class="fs-6 fw-bold text-light">${docs.endpoints.length} Routes</span>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content Layout -->
	<div class="container-fluid px-4 py-4">
		<div class="row g-4">
			<!-- Sidebar -->
			<div class="col-lg-3 col-xl-2">
				<div class="sidebar-sticky">
					<div class="mb-3">
						<input type="search" id="endpoint-search-input" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Search API routes..." />
					</div>

					<div class="text-uppercase small fw-bold text-secondary mb-2 px-2">Getting Started</div>
					<nav class="nav flex-column mb-4">
						<a class="nav-link-custom" href="#overview">Overview</a>
						<a class="nav-link-custom" href="#authentication">Authentication</a>
						<a class="nav-link-custom" href="#roles">Roles & Access</a>
					</nav>

					<div class="text-uppercase small fw-bold text-secondary mb-2 px-2">Endpoints</div>
					<nav class="nav flex-column" id="sidebar-endpoints-nav">
						${docs.endpoints
							.map(
								(ep) => `
							<a class="nav-link-custom" href="#${ep.id}" data-endpoint-id="${ep.id}">
								<span>${ep.title}</span>
								<span class="badge ${ep.method === 'GET' ? 'badge-method-get' : 'badge-method-post'} ms-1" style="font-size: 0.65rem;">${ep.method}</span>
							</a>
						`
							)
							.join('')}
					</nav>
				</div>
			</div>

			<!-- Main Panel -->
			<div class="col-lg-9 col-xl-10">
				<!-- Overview & Auth Section -->
				<section id="overview" class="mb-5">
					<h2 class="h3 fw-bold mb-3"><i class="bi bi-info-circle text-primary me-2"></i>Overview</h2>
					<p class="text-secondary">
						The Bionic Inventory API allows external clients and internal microservices to manage inventory items, query current stock levels, run prefix-matched full-text searches, and post multi-item transactions.
					</p>
				</section>

				<section id="authentication" class="mb-5">
					<h2 class="h3 fw-bold mb-3"><i class="bi bi-shield-lock text-warning me-2"></i>Authentication</h2>
					<div class="card card-endpoint">
						<div class="card-body p-4">
							<p>All API endpoints require authentication using an API token. Pass the token using either of the following HTTP header formats:</p>
							<div class="table-responsive">
								<table class="table table-dark-custom align-middle mb-0">
									<thead>
										<tr>
											<th>Header Name</th>
											<th>Example Value</th>
											<th>Description</th>
										</tr>
									</thead>
									<tbody>
										${docs.authentication.headers
											.map(
												(h) => `
											<tr>
												<td><code>${h.name}</code></td>
												<td><code>${h.example}</code></td>
												<td>${h.description}</td>
											</tr>
										`
											)
											.join('')}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</section>

				<section id="roles" class="mb-5">
					<h2 class="h3 fw-bold mb-3"><i class="bi bi-person-badge text-info me-2"></i>Roles & Permissions</h2>
					<div class="row g-3">
						${docs.authentication.roles
							.map(
								(role) => `
							<div class="col-md-6">
								<div class="card card-endpoint h-100">
									<div class="card-header bg-dark bg-opacity-75 d-flex align-items-center justify-content-between">
										<span class="badge ${role.name === 'producer' ? 'badge-role-producer' : 'badge-role-consumer'} fs-6 text-uppercase">
											${role.name}
										</span>
										<small class="text-secondary">Env: <code>${role.envVar}</code></small>
									</div>
									<div class="card-body p-4">
										<p class="text-secondary mb-3">${role.description}</p>
										<div class="fw-semibold small text-uppercase text-secondary mb-2">Allowed Actions</div>
										<ul class="list-group list-group-flush bg-transparent">
											${role.permissions
												.map(
													(p) => `
												<li class="list-group-item bg-transparent text-light border-secondary small py-1 px-0">
													<i class="bi bi-check-circle-fill text-success me-2"></i>${p}
												</li>
											`
												)
												.join('')}
										</ul>
									</div>
								</div>
							</div>
						`
							)
							.join('')}
					</div>
				</section>

				<!-- Endpoints Section -->
				<section id="endpoints-container">
					<h2 class="h3 fw-bold mb-4"><i class="bi bi-code-slash text-indigo me-2" style="color:#818cf8;"></i>API Endpoints</h2>

					${docs.endpoints.map((ep) => renderEndpointCard(ep)).join('')}
				</section>
			</div>
		</div>
	</div>

	<!-- Bootstrap JS -->
	<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

	<script>
		const ENDPOINTS = ${endpointsJson};

		// Copy snippet helper
		function copySnippet(elementId, btnElement) {
			const text = document.getElementById(elementId).innerText;
			navigator.clipboard.writeText(text).then(() => {
				const origText = btnElement.innerHTML;
				btnElement.innerHTML = '<i class="bi bi-check2"></i> Copied!';
				btnElement.classList.replace('btn-outline-secondary', 'btn-success');
				setTimeout(() => {
					btnElement.innerHTML = origText;
					btnElement.classList.replace('btn-success', 'btn-outline-secondary');
				}, 2000);
			});
		}

		// Filter endpoints by search input
		document.getElementById('endpoint-search-input').addEventListener('input', (e) => {
			const query = e.target.value.toLowerCase().trim();
			ENDPOINTS.forEach((ep) => {
				const card = document.getElementById(ep.id);
				const navLink = document.querySelector('[data-endpoint-id="' + ep.id + '"]');
				const matches = ep.title.toLowerCase().includes(query) ||
					ep.path.toLowerCase().includes(query) ||
					ep.method.toLowerCase().includes(query) ||
					ep.description.toLowerCase().includes(query);

				if (card) card.style.display = matches ? 'block' : 'none';
				if (navLink) navLink.style.display = matches ? 'flex' : 'none';
			});
		});

		// Live Endpoint Try-It-Out Runner
		async function runLiveTest(endpointId) {
			const tokenInput = document.getElementById('test-token-' + endpointId);
			const token = tokenInput ? tokenInput.value.trim() : '';
			const resultPre = document.getElementById('test-result-' + endpointId);
			const statusBadge = document.getElementById('test-status-' + endpointId);

			const ep = ENDPOINTS.find(e => e.id === endpointId);
			if (!ep) return;

			statusBadge.textContent = 'Sending...';
			statusBadge.className = 'badge bg-warning text-dark';
			resultPre.textContent = 'Loading...';

			let url = ep.path;
			let options = {
				method: ep.method,
				headers: {}
			};

			if (token) {
				options.headers['x-api-token'] = token;
			}

			if (ep.method === 'GET') {
				const queryInput = document.getElementById('test-query-' + endpointId);
				if (queryInput && queryInput.value.trim()) {
					const paramName = ep.parameters && ep.parameters[0] ? ep.parameters[0].name : 'q';
					url += '?' + paramName + '=' + encodeURIComponent(queryInput.value.trim());
				}
			} else if (ep.method === 'POST') {
				options.headers['Content-Type'] = 'application/json';
				const bodyInput = document.getElementById('test-body-' + endpointId);
				try {
					const parsed = JSON.parse(bodyInput.value);
					options.body = JSON.stringify(parsed);
				} catch (err) {
					statusBadge.textContent = 'Invalid JSON Body';
					statusBadge.className = 'badge bg-danger';
					resultPre.textContent = 'Error: Body must be valid JSON.\\n' + err.message;
					return;
				}
			}

			try {
				const res = await fetch(url, options);
				const data = await res.json();

				statusBadge.textContent = res.status + ' ' + res.statusText;
				statusBadge.className = res.ok ? 'badge bg-success' : 'badge bg-danger';
				resultPre.textContent = JSON.stringify(data, null, 2);
			} catch (err) {
				statusBadge.textContent = 'Network Error';
				statusBadge.className = 'badge bg-danger';
				resultPre.textContent = 'Error executing fetch: ' + err.message;
			}
		}
	</script>
</body>
</html>`;
}

function renderEndpointCard(ep: ApiEndpointDoc): string {
	const methodBadgeClass = ep.method === 'GET' ? 'badge-method-get' : 'badge-method-post';

	return `
	<div class="card card-endpoint" id="${ep.id}">
		<div class="card-endpoint-header d-flex flex-wrap align-items-center justify-content-between gap-3">
			<div class="d-flex align-items-center gap-3">
				<span class="badge ${methodBadgeClass} fs-6 px-3 py-2">${ep.method}</span>
				<code class="fs-5 text-light">${ep.path}</code>
			</div>
			<div class="d-flex align-items-center gap-2">
				${ep.allowedRoles
					.map(
						(r) => `
					<span class="badge ${r === 'producer' ? 'badge-role-producer' : 'badge-role-consumer'} text-uppercase">
						${r}
					</span>
				`
					)
					.join('')}
			</div>
		</div>

		<div class="card-body p-4">
			<h3 class="h5 fw-bold mb-2">${ep.title}</h3>
			<p class="text-secondary mb-4">${ep.description}</p>

			${
				ep.parameters && ep.parameters.length > 0
					? `
				<h4 class="h6 fw-bold text-uppercase text-secondary mb-3">Parameters</h4>
				<div class="table-responsive mb-4">
					<table class="table table-dark-custom align-middle">
						<thead>
							<tr>
								<th>Name</th>
								<th>In</th>
								<th>Type</th>
								<th>Required</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							${ep.parameters
								.map(
									(p) => `
								<tr>
									<td><code>${p.name}</code></td>
									<td><span class="badge bg-secondary-subtle text-light">${p.in}</span></td>
									<td><code>${p.type}</code></td>
									<td>${p.required ? '<span class="badge bg-danger">Required</span>' : '<span class="badge bg-secondary opacity-75">Optional</span>'}</td>
									<td>${p.description} ${p.default ? `<em>(Default: <code>${p.default}</code>)</em>` : ''}</td>
								</tr>
							`
								)
								.join('')}
						</tbody>
					</table>
				</div>
			`
					: ''
			}

			${
				ep.requestBody
					? `
				<h4 class="h6 fw-bold text-uppercase text-secondary mb-3">Request Body (${ep.requestBody.contentType})</h4>
				<p class="text-secondary small mb-2">${ep.requestBody.description}</p>
				<div class="table-responsive mb-3">
					<table class="table table-dark-custom align-middle">
						<thead>
							<tr>
								<th>Field</th>
								<th>Type</th>
								<th>Required</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							${ep.requestBody.fields
								.map(
									(f) => `
								<tr>
									<td><code>${f.name}</code></td>
									<td><code>${f.type}</code></td>
									<td>${f.required ? '<span class="badge bg-danger">Required</span>' : '<span class="badge bg-secondary opacity-75">Optional</span>'}</td>
									<td>${f.description.replace(/\n/g, '<br/>')}</td>
								</tr>
							`
								)
								.join('')}
						</tbody>
					</table>
				</div>
			`
					: ''
			}

			<!-- Code Examples -->
			<h4 class="h6 fw-bold text-uppercase text-secondary mb-3">Code Examples</h4>
			<div class="mb-4">
				<ul class="nav nav-tabs border-secondary mb-2" id="tab-list-${ep.id}" role="tablist">
					<li class="nav-item" role="presentation">
						<button class="nav-link active text-light py-1 px-3 small" id="curl-tab-${ep.id}" data-bs-toggle="tab" data-bs-target="#curl-pane-${ep.id}" type="button" role="tab">cURL</button>
					</li>
					<li class="nav-item" role="presentation">
						<button class="nav-link text-light py-1 px-3 small" id="js-tab-${ep.id}" data-bs-toggle="tab" data-bs-target="#js-pane-${ep.id}" type="button" role="tab">JavaScript (fetch)</button>
					</li>
				</ul>
				<div class="tab-content">
					<div class="tab-pane fade show active" id="curl-pane-${ep.id}" role="tabpanel">
						<div class="position-relative">
							<button class="btn btn-outline-secondary btn-copy" onclick="copySnippet('code-curl-${ep.id}', this)" id="copy-curl-${ep.id}">
								<i class="bi bi-clipboard"></i> Copy
							</button>
							<pre class="code-block" id="code-curl-${ep.id}">${escapeHtml(ep.curlExample)}</pre>
						</div>
					</div>
					<div class="tab-pane fade" id="js-pane-${ep.id}" role="tabpanel">
						<div class="position-relative">
							<button class="btn btn-outline-secondary btn-copy" onclick="copySnippet('code-js-${ep.id}', this)" id="copy-js-${ep.id}">
								<i class="bi bi-clipboard"></i> Copy
							</button>
							<pre class="code-block" id="code-js-${ep.id}">${escapeHtml(ep.javascriptExample)}</pre>
						</div>
					</div>
				</div>
			</div>

			<!-- Response Examples -->
			<h4 class="h6 fw-bold text-uppercase text-secondary mb-3">Responses</h4>
			<div class="d-flex flex-column gap-3 mb-4">
				${ep.responses
					.map(
						(resp, idx) => `
					<div class="border border-secondary-subtle rounded p-3 bg-dark bg-opacity-50">
						<div class="d-flex align-items-center justify-content-between mb-2">
							<span class="badge ${resp.status < 300 ? 'bg-success' : resp.status < 500 ? 'bg-danger' : 'bg-warning'} fs-6">
								HTTP ${resp.status}
							</span>
							<span class="small text-secondary">${resp.description}</span>
						</div>
						<div class="position-relative">
							<button class="btn btn-outline-secondary btn-copy" onclick="copySnippet('code-resp-${ep.id}-${idx}', this)">
								<i class="bi bi-clipboard"></i> Copy
							</button>
							<pre class="code-block" id="code-resp-${ep.id}-${idx}">${escapeHtml(JSON.stringify(resp.example, null, 2))}</pre>
						</div>
					</div>
				`
					)
					.join('')}
			</div>

			<!-- Live Endpoint Tester -->
			<div class="try-out-box">
				<div class="d-flex align-items-center justify-content-between mb-3">
					<div class="fw-bold text-light"><i class="bi bi-play-circle text-success me-2"></i>Try It Out</div>
					<span id="test-status-${ep.id}" class="badge bg-secondary">Ready</span>
				</div>

				<div class="row g-2 mb-3">
					<div class="col-md-6">
						<label for="test-token-${ep.id}" class="form-label small text-secondary">API Token (Header: x-api-token)</label>
						<input type="text" id="test-token-${ep.id}" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Enter API Token..." />
					</div>
					${
						ep.method === 'GET'
							? `
						<div class="col-md-6">
							<label for="test-query-${ep.id}" class="form-label small text-secondary">Query Parameter (${ep.parameters?.[0]?.name || 'q'})</label>
							<input type="text" id="test-query-${ep.id}" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Value..." />
						</div>
					`
							: ''
					}
				</div>

				${
					ep.method === 'POST' && ep.requestBody
						? `
					<div class="mb-3">
						<label for="test-body-${ep.id}" class="form-label small text-secondary">JSON Request Body</label>
						<textarea id="test-body-${ep.id}" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" rows="4">${escapeHtml(JSON.stringify(ep.requestBody.example, null, 2))}</textarea>
					</div>
				`
						: ''
				}

				<button class="btn btn-indigo btn-sm px-3 mb-3" style="background-color: #6366f1; color: white;" onclick="runLiveTest('${ep.id}')" id="run-test-${ep.id}">
					<i class="bi bi-send-fill me-1"></i> Send Request
				</button>

				<div>
					<label class="form-label small text-secondary">Response Result</label>
					<pre class="code-block" id="test-result-${ep.id}">Click "Send Request" to execute query live against the server.</pre>
				</div>
			</div>
		</div>
	</div>
	`;
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}
