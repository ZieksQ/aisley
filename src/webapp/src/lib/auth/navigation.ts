export function safeReturnPath(value: string | string[] | undefined | null) {
  const path = Array.isArray(value) ? value[0] : value;
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\\\x00-\x20]/.test(path)) return "/";
  return path;
}

export function isProtectedCustomerPath(pathname: string) {
  return ["/account", "/cart", "/checkout", "/orders", "/notifications", "/messages"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
