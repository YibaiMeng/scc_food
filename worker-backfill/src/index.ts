interface Env {
	DB: D1Database;
	scc_food_pdfs: R2Bucket;
}

const PDF_BASE_URL = "https://stgencep.sccgov.org/sccdineout/INSPECTIONREPORT_";
const BATCH_SIZE = 50;

async function ensureTable(db: D1Database): Promise<void> {
	await db
		.prepare(
			`CREATE TABLE IF NOT EXISTS pdf_status (
				inspection_id TEXT PRIMARY KEY,
				status        TEXT NOT NULL,
				r2_key        TEXT,
				size_bytes    INTEGER,
				error_message TEXT,
				created_at    TEXT NOT NULL
			)`,
		)
		.run();
}

async function recordStatus(
	db: D1Database,
	inspectionId: string,
	status: string,
	r2Key: string | null,
	sizeBytes: number | null,
	errorMessage: string | null,
): Promise<void> {
	await db
		.prepare(
			`INSERT OR REPLACE INTO pdf_status (inspection_id, status, r2_key, size_bytes, error_message, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.bind(inspectionId, status, r2Key, sizeBytes, errorMessage, new Date().toISOString())
		.run();
}

async function processBatch(env: Env): Promise<void> {
	await ensureTable(env.DB);

	// Check if backfill already finished — skip the expensive LEFT JOIN
	const done = await env.DB.prepare("SELECT value FROM metadata WHERE key = 'backfill_pdfs_done'").first<{
		value: string;
	}>();
	if (done) {
		return;
	}

	// Find unprocessed inspections
	const { results: batch } = await env.DB.prepare(
		`SELECT i.inspection_id FROM inspection i
		 LEFT JOIN pdf_status p ON i.inspection_id = p.inspection_id
		 WHERE p.inspection_id IS NULL
		 LIMIT ?`,
	)
		.bind(BATCH_SIZE)
		.all<{ inspection_id: string }>();

	if (batch.length === 0) {
		const total = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM pdf_status").first<{ cnt: number }>();
		console.log(`Backfill complete. ${total?.cnt ?? 0} total PDFs processed. Cron will now no-op.`);
		await env.DB.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('backfill_pdfs_done', ?)").bind(new Date().toISOString()).run();
		return;
	}

	// Count remaining before processing (for logging)
	const remainingRow = await env.DB.prepare(
		`SELECT COUNT(*) AS cnt FROM inspection i
		 LEFT JOIN pdf_status p ON i.inspection_id = p.inspection_id
		 WHERE p.inspection_id IS NULL`,
	).first<{ cnt: number }>();
	const remaining = remainingRow?.cnt ?? 0;

	let ok = 0;
	let notFound = 0;
	let errors = 0;
	let rateLimited = false;

	for (const row of batch) {
		const inspectionId = row.inspection_id;
		const pdfUrl = `${PDF_BASE_URL}${inspectionId}.pdf`;
		const r2Key = `reports/${inspectionId}.pdf`;

		try {
			const resp = await fetch(pdfUrl);

			if (resp.status === 404) {
				await recordStatus(env.DB, inspectionId, "not_found", null, null, null);
				notFound++;
				continue;
			}

			if (resp.status === 429) {
				console.log(`Rate limited at ${inspectionId}. Stopping batch early.`);
				rateLimited = true;
				break;
			}

			if (!resp.ok) {
				const msg = `HTTP ${resp.status}`;
				await recordStatus(env.DB, inspectionId, "error", null, null, msg);
				errors++;
				continue;
			}

			// Stream PDF body directly to R2
			const r2Obj = await env.scc_food_pdfs.put(r2Key, resp.body, {
				httpMetadata: { contentType: "application/pdf" },
			});

			const size = r2Obj?.size ?? 0;
			await recordStatus(env.DB, inspectionId, "ok", r2Key, size, null);
			ok++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await recordStatus(env.DB, inspectionId, "error", null, null, msg);
			errors++;
		}
	}

	const processed = ok + notFound + errors;
	const nowRemaining = remaining - processed;
	console.log(
		`Batch done: ${processed} processed (${ok} ok, ${notFound} not_found, ${errors} error). ` +
			`${nowRemaining} remaining.${rateLimited ? " Stopped early: rate limited." : ""}`,
	);
}

export default {
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(processBatch(env));
	},
};
