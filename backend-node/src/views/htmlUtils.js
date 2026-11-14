/**
 * Escape HTML special characters to prevent XSS in server-rendered views.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialize JS data safely for embedding inside inline <script> tags.
 */
export function safeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Format Vietnamese Dong amounts clearly for mobile web cards and dashboards.
 */
export function formatVnd(amount) {
  const num = Number(amount) || 0;
  return `${num.toLocaleString('vi-VN')}đ`;
}
