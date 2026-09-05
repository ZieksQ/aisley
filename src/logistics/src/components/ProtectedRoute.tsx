import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
export function ProtectedRoute() { const { logistics, loading } = useAuth(); const location = useLocation(); if (loading) return <div className="grid min-h-screen place-items-center bg-[#f7f7f8] text-sm dark:bg-[#101012] dark:text-white">Checking your session…</div>; return logistics ? <Outlet /> : <Navigate replace state={{ from: location.pathname }} to="/login" /> }
