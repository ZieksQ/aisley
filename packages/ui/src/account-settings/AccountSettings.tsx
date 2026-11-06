"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { ConfirmationDialog } from "../portal/ConfirmationDialog";
import "./account-settings.css";

export type AccountSettingsSection = {
  id: string;
  label: string;
  description: string;
};

type SettingsContext = { active: string; prefix: string };
const Context = createContext<SettingsContext | null>(null);
const SectionVisibility = createContext(true);

type AccountSettingsProps = {
  sections: readonly AccountSettingsSection[];
  activeSection: string | null;
  onSectionChange: (section: string) => void;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: ReactNode;
  children: ReactNode;
  customer?: boolean;
  headingLevel?: 1 | 2;
  title?: string;
};

export function AccountSettings({
  sections, activeSection, onSectionChange, name, email, role, status, avatar, children,
  customer = false, headingLevel = 1, title = "Account settings",
}: AccountSettingsProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const ContextHeading = headingLevel === 1 ? "h2" : "h3";
  const prefix = useId();
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active.id]);

  return (
    <Context.Provider value={{ active: active.id, prefix }}>
      <div className={`account-settings${customer ? " account-settings-customer" : ""}`}>
        <header className="account-settings-heading">
          <Heading>{title}</Heading>
          <p>Manage your profile and the settings that matter to your {role.toLowerCase()} account.</p>
        </header>
        <div className="account-settings-identity">
          {avatar}
          <div className="account-settings-person">
            <p className="account-settings-name">{name || role}</p>
            <p className="account-settings-email">{email}</p>
          </div>
          <dl className="account-settings-status">
            <div><dt>Account</dt><dd>{role}</dd></div>
            <div><dt>Status</dt><dd>{status}</dd></div>
          </dl>
        </div>
        <nav className="account-settings-nav" aria-label="Account settings sections" ref={nav}>
          {sections.map((section) => (
            <button
              id={`${prefix}-${section.id}-link`}
              key={section.id}
              type="button"
              aria-current={active.id === section.id ? "page" : undefined}
              aria-controls={`${prefix}-${section.id}`}
              onClick={() => onSectionChange(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>
        <div className="account-settings-workspace">
          <div className="account-settings-context">
            <ContextHeading>{active.label}</ContextHeading>
            <p>{active.description}</p>
            <p className="account-settings-privacy">Your changes apply to this account. Save each form when you’re ready.</p>
          </div>
          <div className="account-settings-content">{children}</div>
        </div>
      </div>
    </Context.Provider>
  );
}

/** Ordinary forms stay mounted to preserve drafts and in-flight uploads. */
export function AccountSection({ id, children, sensitive = false }: {
  id: string;
  children: ReactNode;
  sensitive?: boolean;
}) {
  const context = useContext(Context);
  if (!context) throw new Error("AccountSection requires AccountSettings.");
  const active = context.active === id;
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  return (
    <SectionVisibility.Provider value={active}>
      <div id={`${context.prefix}-${id}`} aria-labelledby={`${context.prefix}-${id}-link`} hidden={!active}>
        {(sensitive ? active : active || visited) && children}
      </div>
    </SectionVisibility.Provider>
  );
}

export function AccountRemovalConfirmation(props: ComponentProps<typeof ConfirmationDialog>) {
  const visible = useContext(SectionVisibility);
  return visible ? <ConfirmationDialog {...props} /> : null;
}

export function AccountSettingsFeedback({ error, message }: { error?: string | null; message?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error || message) ref.current?.focus(); }, [error, message]);
  if (!error && !message) return null;
  return (
    <div
      className={`account-settings-feedback${error ? " account-settings-feedback-error" : ""}`}
      ref={ref}
      tabIndex={-1}
      role={error ? "alert" : "status"}
    >
      {error || message}
    </div>
  );
}

export function AccountSettingsState({ error, onRetry, headingLevel = 1, title = "Account settings" }: { error?: string | null; onRetry?: () => void; headingLevel?: 1 | 2; title?: string }) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="account-settings account-settings-state">
      <Heading>{title}</Heading>
      {error ? (
        <div className="account-settings-state-panel" role="alert">
          <h2>We couldn’t load your settings</h2>
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Try again</button>
        </div>
      ) : (
        <div className="account-settings-state-panel" aria-busy="true" aria-label="Loading account settings">
          <p role="status">Loading your account…</p>
          <div className="account-settings-skeleton" />
          <div className="account-settings-skeleton" />
        </div>
      )}
    </div>
  );
}
