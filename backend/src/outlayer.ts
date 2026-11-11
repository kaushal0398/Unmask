/**
 * Run the auction on OutLayer over its HTTPS API: POST {base}/call/{owner}/{project} (spec: https://api.outlayer.ai/openapi.json).
 *
 * Built from the published OpenAPI spec and tested against a stub that follows it. It has NOT been run against the real
 * service: that needs a payment key (`{owner}:{nonce}:{secret}`), which this repository does not have. Keep the key in the
 * server environment only.
 *
 * Calls are asynchronous: the API answers at once with a call id, and this polls until the call settles. A completed call
 * carries `output` (the project's JSON) and `attestation_url` (the TEE quote for that execution). Having an attestation
 * URL does NOT mean we have verified it: see docs/OUTLAYER_ATTESTATION.md.
 */
export class OutLayerError extends Error {
  constructor(public readonly reason: string, message: string, public readonly terminal?: boolean) {
    super(message);
    this.name = "OutLayerError";
  }
}

export type OutLayerRun = {
  callId: string;
  /** The project's output as JSON text. OutLayer returns it parsed, so this is our own serialisation of it. */
  raw: string;
  output: unknown;
  attestationUrl: string | null;
  computeCost: string | null;
  instructions: number | null;
  timeMs: number | null;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type CallBody = {
  call_id?: string; status?: "pending" | "completed" | "failed"; output?: unknown; error?: string | null;
  compute_cost?: string | null; instructions?: number | null; time_ms?: number | null;
  poll_url?: string | null; attestation_url?: string | null; reason?: string; terminal?: boolean;
};

/** What to tell a person for the refusals they can act on. Anything else falls back to OutLayer's own sentence. */
const ADVICE: Record<string, string> = {
  missing_payment_key: "OutLayer needs a payment key. Set OUTLAYER_PAYMENT_KEY on the server.",
  bad_key_format: "The OutLayer payment key is not in the form owner:nonce:secret.",
  invalid_key: "OutLayer does not accept this payment key.",
  insufficient_balance: "The OutLayer payment key has run out of funds.",
  out_of_funds: "The OutLayer payment key has run out of funds.",
  trial_exhausted: "The OutLayer trial key has used all its calls.",
  trial_expired: "The OutLayer trial key has expired.",
  project_not_found: "OutLayer does not know this project. Check OUTLAYER_PROJECT.",
  project_not_allowed: "This payment key may not call this project.",
  rate_limit_exceeded: "OutLayer is rate limiting this key. Try again shortly.",
  upstream_unavailable: "OutLayer is not ready right now. Try again shortly.",
};

export function createOutLayerClient(cfg: { base?: string; project: string; paymentKey: string; versionKey?: string; fetchImpl?: FetchLike; pollMs?: number; timeoutMs?: number }) {
  const base = (cfg.base ?? "https://testnet-api.outlayer.ai").replace(/\/+$/, "");
  const [owner, name, ...rest] = cfg.project.split("/");
  if (!owner || !name || rest.length) throw new OutLayerError("bad_config", `OUTLAYER_PROJECT must look like owner/project, got "${cfg.project}".`);
  const doFetch: FetchLike = cfg.fetchImpl ?? ((u, i) => fetch(u, i));
  const pollMs = cfg.pollMs ?? 1000;
  const timeoutMs = cfg.timeoutMs ?? 90_000;
  const headers = { "Content-Type": "application/json", "X-Payment-Key": cfg.paymentKey };

  async function send(url: string, init?: RequestInit): Promise<{ status: number; body: CallBody | null }> {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, headers: { ...headers, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new OutLayerError("network", "Could not reach OutLayer.");
    }
    return { status: res.status, body: (await res.json().catch(() => null)) as CallBody | null };
  }

  function refusal(status: number, body: CallBody | null): never {
    const reason = body?.reason ?? `http_${status}`;
    throw new OutLayerError(reason, ADVICE[reason] ?? body?.error ?? `OutLayer answered ${status}.`, body?.terminal);
  }

  function finish(body: CallBody, callId: string): OutLayerRun {
    if (body.status === "failed") throw new OutLayerError("failed", body.error ?? "The execution failed on OutLayer.");
    if (body.output === null || body.output === undefined) throw new OutLayerError("no_output", "OutLayer finished the call but returned no output.");
    return { callId, output: body.output, raw: JSON.stringify(body.output), attestationUrl: body.attestation_url ?? null, computeCost: body.compute_cost ?? null, instructions: body.instructions ?? null, timeMs: body.time_ms ?? null };
  }

  return {
    async run(input: object): Promise<OutLayerRun> {
      const first = await send(`${base}/call/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, {
        method: "POST",
        body: JSON.stringify({ input, async: true, ...(cfg.versionKey ? { version_key: cfg.versionKey } : {}) }),
      });
      // 408 means the synchronous window passed; the body still carries a poll_url, so keep polling.
      if (first.status !== 200 && first.status !== 408) refusal(first.status, first.body);
      const callId = first.body?.call_id;
      if (!callId) throw new OutLayerError("bad_response", "OutLayer did not return a call id.");
      let body = first.body!;
      const deadline = Date.now() + timeoutMs;
      while (body.status === "pending" || first.status === 408 && !body.status) {
        if (Date.now() > deadline) throw new OutLayerError("timeout", `OutLayer did not finish call ${callId} within ${Math.round(timeoutMs / 1000)} seconds.`);
        await new Promise((r) => setTimeout(r, pollMs));
        const pollUrl = body.poll_url ? new URL(body.poll_url, `${base}/`).toString() : `${base}/calls/${encodeURIComponent(callId)}`;
        const next = await send(pollUrl);
        if (next.status !== 200) refusal(next.status, next.body);
        body = { ...next.body!, poll_url: next.body?.poll_url ?? body.poll_url };
      }
      return finish(body, callId);
    },
  };
}
