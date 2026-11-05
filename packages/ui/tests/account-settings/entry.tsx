import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link } from 'react-router-dom';
import { PortalShell, PortalNavigation } from '@aisley/ui/portal';
import { LuLayoutDashboard, LuUserRoundCog } from 'react-icons/lu';
import { AccountPage as Admin } from '/src/admin/src/pages/AccountPage';
import { AccountPage as Seller } from '/src/seller/src/pages/AccountPage';
import { AccountPage as Logistics } from '/src/logistics/src/pages/AccountPage';
import { CustomerAccountContent as Customer } from '/src/webapp/src/components/account/customer-account-content';
import './harness.css';

const role = new URLSearchParams(location.search).get('role') ?? 'seller';
if (new URLSearchParams(location.search).get('theme') === 'dark' && role !== 'customer') {
  document.documentElement.classList.add('dark');
}
const Screen = { admin: Admin, seller: Seller, logistics: Logistics, customer: Customer }[role] ?? Seller;
const navigation = (
  <PortalNavigation
    label="Fixture workspace"
    renderLink={(props) => <Link {...props} />}
    groups={[{ id: 'workspace', items: [
      { path: '/dashboard', label: 'Overview', icon: <LuLayoutDashboard /> },
      { path: '/account', label: 'Account settings', icon: <LuUserRoundCog />, active: true },
    ] }]}
  />
);

// Use the actual production portal shell. Only auth/API data and route lists are synthetic.
const content = role === 'customer' ? (
  <div className="portal-shell fixture-customer" data-role="customer">
    <header className="fixture-top">AISLEY <span>My account</span></header>
    <main><Screen /></main>
  </div>
) : (
  <PortalShell
    role={role as 'admin' | 'seller' | 'logistics'}
    title="Account settings"
    routeKey="/account"
    navigation={navigation}
    account={{ name: 'Mara Santos', email: 'mara.santos@example.test', avatar: <span>MS</span> }}
    onLogout={() => {}}
    signingOut={false}
  >
    <Screen />
  </PortalShell>
);
createRoot(document.getElementById('root')!).render(<BrowserRouter>{content}</BrowserRouter>);
