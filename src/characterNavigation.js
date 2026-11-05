export const characterTabIds = ["overview", "abilities", "design", "visuals", "story"];

export function characterViewFromSearch(search = "") {
  const view = new URLSearchParams(search).get("tab");
  return characterTabIds.includes(view) ? view : "overview";
}

export function characterViewUrl({ pathname, search = "", hash = "" }, view) {
  const query = new URLSearchParams(search);
  if (view === "overview" || !characterTabIds.includes(view)) query.delete("tab");
  else query.set("tab", view);
  return `${pathname}${query.size ? `?${query}` : ""}${hash}`;
}
