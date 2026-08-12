import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getApiDocumentation, getOpenApiSpec } from '$lib/server/api-docs';
import { renderApiDocHtml } from '$lib/server/api-docs-html';

export const GET: RequestHandler = async ({ request, url }) => {
	const format = url.searchParams.get('format')?.toLowerCase();
	const accept = request.headers.get('accept')?.toLowerCase() || '';

	if (format === 'openapi' || format === 'json' || (accept.includes('application/json') && !accept.includes('text/html'))) {
		return json(getOpenApiSpec());
	}

	if (format === 'legacy') {
		return new Response(renderApiDocHtml(getApiDocumentation()), {
			headers: {
				'content-type': 'text/html; charset=utf-8'
			}
		});
	}

	const scalarConfig = JSON.stringify({
		hideClientButton: true,
		hideDownloadButton: true,
		customCss: `
			a[href*="scalar.com"] { display: none !important; }
			.scalar-footer { display: none !important; }
		`
	});

	// Render @scalar/api-reference API browser
	const scalarHtml = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Bionic Inventory API Reference</title>
	<meta name="description" content="Interactive API reference and documentation for Bionic Inventory API" />
	<style>
		body {
			margin: 0;
			padding: 0;
			background-color: #0f172a;
		}
	</style>
</head>
<body>
	<script
		id="api-reference"
		data-url="/api?format=openapi"
		data-configuration='${scalarConfig.replace(/'/g, "&apos;")}'
		src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

	return new Response(scalarHtml, {
		headers: {
			'content-type': 'text/html; charset=utf-8'
		}
	});
};
