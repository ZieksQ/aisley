// Compatibility entry point: exercise the actual Logistics route through the shared suite.
// Build Logistics first, then run this file from the repository root.
process.env.NOTIFICATION_BROWSER_ROLES ??= 'logistics';
await import('../../../packages/ui/tests/notifications-browser.mjs');
