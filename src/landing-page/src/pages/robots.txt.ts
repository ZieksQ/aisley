export function GET() {
  const indexable = import.meta.env.INDEXABLE === 'true' && !import.meta.env.DEV;
  const content = indexable
    ? 'User-agent: *\nAllow: /\nSitemap: https://info.aisley.app/sitemap.xml\n'
    : 'User-agent: *\nDisallow: /\n';

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
