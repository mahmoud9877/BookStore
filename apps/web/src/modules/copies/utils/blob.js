import { apiClient } from "../../../lib/resource.js";

/**
 * Opens a protected file in a new tab: fetched with the session's credentials
 * as a blob, so no unauthenticated URL ever exists. `download` saves it instead.
 */
export async function openProtectedFile(url, { fileName, download = false } = {}) {
  const response = await apiClient.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  if (download) {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName ?? "download";
    link.click();
  } else {
    window.open(objectUrl, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
