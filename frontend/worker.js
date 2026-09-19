// Solo recibe /api/* (run_worker_first en wrangler.jsonc): lo reenvía al motor. Lo demás son estáticos.
export default {
  fetch(req, env) {
    const url = new URL(req.url)
    return fetch(new Request(env.API_ORIGIN + url.pathname + url.search, req))
  },
}
