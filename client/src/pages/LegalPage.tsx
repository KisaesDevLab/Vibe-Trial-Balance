// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Public, unauthenticated /privacy and /terms pages. Intuit's production
 * checklist requires a public HTTPS privacy-policy URL and end-user licence
 * URL for any app that reads QuickBooks data, and the QuickBooks API page
 * prints these two addresses for the administrator to paste in.
 *
 * The operator (the firm running this installation) is named from the
 * Firm identity settings; until those are filled in the pages say so
 * rather than presenting an anonymous policy.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLegalInfo, type LegalInfo } from '../api/legal';

const APP_NAME = 'Vibe Trial Balance';
const LICENSOR = 'Kisaes LLC';

function useLegalInfo(): LegalInfo | null {
  const [info, setInfo] = useState<LegalInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    getLegalInfo().then((r) => {
      if (!cancelled) setInfo(r.data ?? { firmName: '', firmAddress: '', contactEmail: '' });
    });
    return () => { cancelled = true; };
  }, []);
  return info;
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-900 dark:text-white mt-6 mb-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{children}</p>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Shell({ title, other, info, children }: { title: string; other: { to: string; label: string }; info: LegalInfo | null; children: React.ReactNode }) {
  const operator = info?.firmName?.trim() || 'the firm operating this installation';
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">{APP_NAME}</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Operated by <span className="font-medium text-gray-700 dark:text-gray-300">{operator}</span>
          {info?.firmAddress?.trim() ? <> · {info.firmAddress}</> : null}
        </p>
        {info && !info.firmName.trim() && (
          <div className="mb-4 px-3 py-2 rounded text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
            The operator's name has not been entered yet. An administrator sets it under Settings → Firm identity; it then appears here and in every PDF header.
          </div>
        )}
        {children}
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-sm">
          <Link to={other.to} className="text-blue-600 dark:text-blue-400 hover:underline">{other.label}</Link>
          <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

function Contact({ info }: { info: LegalInfo | null }) {
  const email = info?.contactEmail?.trim();
  return (
    <>
      <H>Contact</H>
      <P>
        Questions about this document go to {info?.firmName?.trim() || 'the operator'}
        {email ? <> at <a href={`mailto:${email}`} className="text-blue-600 dark:text-blue-400 hover:underline">{email}</a></> : null}
        {info?.firmAddress?.trim() ? <>, {info.firmAddress}</> : null}.
      </P>
    </>
  );
}

export function PrivacyPolicyPage() {
  const info = useLegalInfo();
  const operator = info?.firmName?.trim() || 'the operator';
  return (
    <Shell title="Privacy Policy" other={{ to: '/terms', label: 'End-User License Agreement' }} info={info}>
      <P>
        {APP_NAME} is accounting workpaper software that {operator} runs on its own server for its own staff. This
        policy explains what the software collects, why, and what happens to it. It applies to everyone who signs in
        to this installation and to anyone whose QuickBooks Online company is connected to it.
      </P>

      <H>Who is responsible</H>
      <P>
        {operator} is the data controller for this installation. The software is licensed from {LICENSOR}, which has no
        access to this server and receives no data from it. Nothing this installation stores is sent to {LICENSOR}.
      </P>

      <H>What is collected</H>
      <UL items={[
        <><strong>Account details of staff users</strong> — name, username, email address, role and hashed password, so that each person can sign in and their actions can be attributed to them.</>,
        <><strong>Client accounting records</strong> that staff enter or import — chart of accounts, trial balances, journal entries, bank transactions, tax-line mappings, notes and supporting documents — because preparing financial statements and tax workpapers is what the software is for.</>,
        <><strong>QuickBooks Online data</strong>, when a client company is connected: the company name and preferences, the chart of accounts, and Trial Balance reports for the periods being worked on. Access is <strong>read-only</strong> and limited to the accounting scope; nothing is ever written back to QuickBooks.</>,
        <><strong>Audit log entries</strong> — who did what and when — kept as evidence that review and sign-off took place.</>,
      ]} />

      <H>How QuickBooks access works</H>
      <UL items={[
        "A person with administrator access to the QuickBooks company authorizes the connection through Intuit's consent screen. Intuit issues tokens to this installation; QuickBooks passwords are never seen or stored.",
        "Tokens are stored encrypted on this server and are refreshed only to keep the connection alive. They are revoked at Intuit when the connection is disconnected here, or can be revoked at any time from the QuickBooks company's My Apps page.",
        'Each import records the exact report QuickBooks returned, so every balance can be traced to its source. Reports are fetched on demand; there is no continuous sync.',
      ]} />

      <H>How data is used</H>
      <P>
        Solely to prepare, review and file the accounting and tax work {operator} performs for its clients, and to keep
        the records that professional standards require. Data is not sold, rented, or used for advertising.
      </P>

      <H>Sharing</H>
      <UL items={[
        <><strong>Intuit</strong> receives the requests needed to read a connected company (company id, report dates, and the authorization tokens it issued). Intuit's handling of that traffic is covered by Intuit's own privacy policy.</>,
        <><strong>AI features</strong>, if enabled by the administrator, send selected account names and amounts to the configured AI provider to suggest classifications. Client names and bank account numbers are removed first, and every AI feature asks for confirmation before its first use. The QuickBooks import itself sends nothing to any AI provider.</>,
        <><strong>Document storage</strong>, if the administrator has configured an external bucket, holds uploaded files under {operator}'s own account with that provider.</>,
        'Regulators, courts and professional bodies, where the law or professional obligations require it.',
      ]} />

      <H>Retention</H>
      <P>
        Records are kept for as long as {operator} is engaged by the client and thereafter for the period its
        professional retention obligations require. Disconnecting a QuickBooks company stops further access
        immediately; balances already imported remain part of the client's workpapers. Staff accounts are deactivated
        when a person leaves and their audit-log entries are retained.
      </P>

      <H>Security</H>
      <UL items={[
        'Every page and API call requires sign-in; administrator functions are restricted to administrator accounts.',
        'Credentials, API keys and QuickBooks tokens are stored encrypted; passwords are stored as one-way hashes.',
        'All traffic to this installation and to Intuit is over HTTPS.',
        'Nightly backups are made so that records survive hardware failure; backups carry the same protections as the live data.',
      ]} />

      <H>Your rights</H>
      <P>
        Clients may ask {operator} what is held about them, ask for corrections, and revoke the QuickBooks
        connection at any time. Staff users can see and change their own account details after signing in.
      </P>

      <H>Changes</H>
      <P>This page is updated when the software or {operator}'s practices change. The current version is always the one published at this address.</P>

      <Contact info={info} />
    </Shell>
  );
}

export function TermsPage() {
  const info = useLegalInfo();
  const operator = info?.firmName?.trim() || 'the operator';
  return (
    <Shell title="End-User License Agreement" other={{ to: '/privacy', label: 'Privacy Policy' }} info={info}>
      <P>
        These terms govern use of this installation of {APP_NAME}, operated by {operator}. By signing in, or by
        authorizing a QuickBooks Online connection to it, you agree to them.
      </P>

      <H>1. What this is</H>
      <P>
        {APP_NAME} is trial-balance and workpaper software used by {operator}'s staff to prepare financial statements
        and tax returns. It is a private, single-firm installation — not a public service and not an Intuit product.
        The software itself is licensed to {operator} by {LICENSOR} under the PolyForm Small Business License 1.0.0;
        that license, not these terms, governs the software's source code.
      </P>

      <H>2. Who may use it</H>
      <UL items={[
        <>Staff and contractors of {operator} who have been issued an account, for {operator}'s professional work only.</>,
        <>Clients of {operator}, or their authorized representatives, for the sole purpose of authorizing (and, if they wish, revoking) a read-only QuickBooks Online connection to their company.</>,
        'Accounts are personal. Do not share credentials, and tell an administrator immediately if you believe yours have been exposed.',
      ]} />

      <H>3. QuickBooks Online connections</H>
      <UL items={[
        "A connection lets this installation READ the connected company's chart of accounts and Trial Balance reports. It never posts, edits or deletes anything in QuickBooks.",
        'Only a person with authority over the QuickBooks company may authorize a connection. By authorizing one, you confirm you have that authority.',
        <>The connection can be ended at any time — from Setup → QuickBooks inside the application, or from the company's My Apps page in QuickBooks. Data already imported remains part of {operator}'s workpapers under its engagement with the client.</>,
        "Use of QuickBooks Online itself is governed by Intuit's terms of service.",
      ]} />

      <H>4. Acceptable use</H>
      <UL items={[
        'Use the software only for lawful purposes and only for the engagements you are assigned to.',
        "Do not attempt to bypass access controls, extract other clients' data, or interfere with the server.",
        'Do not upload material you do not have the right to process.',
      ]} />

      <H>5. Data</H>
      <P>
        Data entered into or imported by this installation belongs to the client it concerns and is held by {operator}
        under its engagement terms and professional obligations. How it is collected, used and protected is described
        in the <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>.
      </P>

      <H>6. No warranty; limitation of liability</H>
      <P>
        The software is provided "as is". Neither {operator} nor {LICENSOR} warrants that it is error-free or
        uninterrupted. Figures it produces are working papers that a qualified professional reviews before anything is
        filed; they are not advice in themselves. To the fullest extent permitted by law, neither {operator} nor{' '}
        {LICENSOR} is liable for indirect, incidental or consequential loss arising from use of the software. Nothing in
        these terms limits liability that cannot be limited by law or alters the terms of {operator}'s engagement
        letter with a client.
      </P>

      <H>7. Termination</H>
      <P>
        {operator} may suspend or remove an account at any time. A client may revoke a QuickBooks connection at any
        time. Sections 5 and 6 survive termination.
      </P>

      <H>8. Changes and governing law</H>
      <P>
        {operator} may update these terms by publishing a new version at this address. These terms are governed by the
        law of the jurisdiction in which {operator} is established, unless an engagement letter provides otherwise.
      </P>

      <Contact info={info} />
    </Shell>
  );
}
