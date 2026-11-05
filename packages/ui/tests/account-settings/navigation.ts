import { useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
const original = window.history.pushState.bind(window.history);
window.history.pushState = (...args) => { original(...args); window.dispatchEvent(new Event('fixture-query')); };
const subscribe = (change:()=>void) => {window.addEventListener('popstate',change);window.addEventListener('fixture-query',change);return ()=>{window.removeEventListener('popstate',change);window.removeEventListener('fixture-query',change);};};
export function useSearchParams() { return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search)); }
export function usePathname() { return useLocation().pathname; }
export function useRouter() { const navigate=useNavigate(); return { push: (url: string) => navigate(url), replace: (url: string) => navigate(url, {replace:true}) }; }
