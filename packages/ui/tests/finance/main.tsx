import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { fixture } from './fixtures'
import { FinancePage as AdminFinance } from '../../../../src/admin/src/pages/FinancePage'
import { FinancePage as SellerFinance } from '../../../../src/seller/src/pages/FinancePage'
import { FinancePage as LogisticsFinance } from '../../../../src/logistics/src/pages/FinancePage'
import { FinancePaymentsPage as AdminPayments } from '../../../../src/admin/src/pages/FinancePaymentsPage'
import { FinancePaymentsPage as SellerPayments } from '../../../../src/seller/src/pages/FinancePaymentsPage'
import { FinancePaymentsPage as LogisticsPayments } from '../../../../src/logistics/src/pages/FinancePaymentsPage'
import { CourierCashPage } from '../../../../src/logistics/src/pages/CourierCashPage'
import { FinanceHoldsPage } from '../../../../src/admin/src/pages/FinanceHoldsPage'
import './styles.css'
const role = fixture.role
const Overview = { admin: AdminFinance, seller: SellerFinance, logistics: LogisticsFinance }[role]
const Payments = { admin: AdminPayments, seller: SellerPayments, logistics: LogisticsPayments }[role]
document.documentElement.classList.toggle('dark', new URLSearchParams(location.search).get('theme') === 'dark')
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="portal-shell" data-role={role}>
  <aside className="fixture-sidebar"><strong>AISLEY</strong><p>{role} portal</p><a href="/finance">Finance</a></aside>
  <div className="fixture-main"><header className="fixture-top"><h1>AISLEY · {role} Finance</h1></header><Routes>
    <Route path="/finance" element={<Overview />} />
    <Route path="/finance/courier-cash" element={<CourierCashPage />} />
    <Route path="/finance-holds" element={<FinanceHoldsPage />} />
    <Route path="/finance-holds/:holdId" element={<FinanceHoldsPage />} />
    <Route path="/finance/remittances/invoices/:invoiceId" element={<Payments />} />
    <Route path="/finance/remittances/:batchId" element={<Payments />} />
    <Route path="/finance/*" element={<Payments />} />
  </Routes></div>
</div></BrowserRouter>)
