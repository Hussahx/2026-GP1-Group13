/**
 * ═══════════════════════════════════════════════
 *  راصد — Dynamic Sidebar Menu
 *  sidebar-menu.js
 *
 *  Usage:
 *    import { renderMenu } from '/JS/sidebar-menu.js';
 *    renderMenu('admin');   // or 'volunteer'
 *
 *  To add a new role, add an entry to ROLE_MENUS below.
 * ═══════════════════════════════════════════════
 */

// ─── Menu Configuration ───────────────────────────────────────────────────────
// Each role maps to an array of menu item descriptors.
// Special type "divider" inserts a <div class="sidebar-divider">.
//
// Properties per item:
//   label  {string}  — Arabic display text
//   href   {string}  — Link target
//   icon   {string}  — Font Awesome class (e.g. "fas fa-users")
//   key    {string}  — Unique key used to match the active page
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_MENUS = {

  admin: [
    {
      label : 'طلبات التسجيل',
      href  : 'AdminControlPanel.html',
      icon  : 'fas fa-users',
      key   : 'AdminControlPanel',
    },
    {
      label : 'السجل',
      href  : 'History.html',
      icon  : 'fas fa-clock-rotate-left',
      key   : 'History',
    },
  ],

  volunteer: [
    {
      label : 'لوحة التحكم',
      href  : '#',
      icon  : 'fas fa-gauge-high',
      key   : 'Dashboard',
    },
    { type: 'divider' },
    {
      label : 'البلاغات',
      href  : 'Reports.html',
      icon  : 'fas fa-bullhorn',
      key   : 'Reports',
    },
    {
      label : 'السجل',
      href  : 'History.html',
      icon  : 'fas fa-clock-rotate-left',
      key   : 'History',
    },
    { type: 'divider' },
    {
      label : 'الملف الشخصي',
      href  : 'profile1.html',
      icon  : 'fas fa-user',
      key   : 'Profile',
    },
  ],

};

// ─── Active-Page Detection ────────────────────────────────────────────────────
/**
 * Returns the "key" of the current page by matching the page filename
 * against each menu item's href across ALL roles.
 */
function detectActiveKey() {
  const currentFile = window.location.pathname
    .split('/')
    .pop()
    .replace(/[?#].*$/, '')   // strip query / hash
    .toLowerCase();

  for (const items of Object.values(ROLE_MENUS)) {
    for (const item of items) {
      if (item.type === 'divider') continue;
      const itemFile = item.href.split('/').pop().toLowerCase();
      if (currentFile === itemFile) return item.key;
    }
  }
  return null;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
/**
 * Builds and injects the sidebar <nav> content for the given role.
 *
 * @param {string} role            - 'admin' | 'volunteer' | any future role
 * @param {string} [containerId]   - ID of the <nav class="sidebar-nav"> element
 *                                   Defaults to 'sidebarNav'
 */
export function renderMenu(role, containerId = 'sidebarNav') {
  const nav = document.getElementById(containerId);
  if (!nav) {
    console.warn(`[renderMenu] Container #${containerId} not found.`);
    return;
  }

  const items = ROLE_MENUS[role];
  if (!items) {
    console.warn(`[renderMenu] Unknown role: "${role}". No menu rendered.`);
    nav.innerHTML = '';
    return;
  }

  const activeKey = detectActiveKey();

  // Build the section label once
  let html = `<span class="sidebar-section-label">القائمة الرئيسية</span>\n`;

  for (const item of items) {

    // — Divider —
    if (item.type === 'divider') {
      html += `<div class="sidebar-divider"></div>\n`;
      continue;
    }

    // — Link —
    const isActive = item.key === activeKey;
    html += `
      <a href="${escHtml(item.href)}"
         class="sidebar-link${isActive ? ' active' : ''}"
         ${isActive ? 'aria-current="page"' : ''}>
        <i class="${escHtml(item.icon)}" aria-hidden="true"></i>
        <span>${escHtml(item.label)}</span>
      </a>
    `;
  }

  nav.innerHTML = html;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}