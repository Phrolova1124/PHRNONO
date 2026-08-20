export default {
  async fetch(request, env) {
    const assets = env.SITE_ASSETS ?? env.ASSETS;
    const response = await assets.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return assets.fetch(new Request(indexUrl, request));
  },
};
