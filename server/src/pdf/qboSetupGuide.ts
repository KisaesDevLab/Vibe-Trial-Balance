// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * The QuickBooks Online setup guide, as pdfmake content. Generated per
 * request so it prints THIS instance's effective redirect URI and
 * environment — the two values an operator has to copy into the Intuit
 * developer portal exactly. Mirrored in `server/knowledge/quickbooks.md` for
 * the support chat.
 */
import type { Content } from 'pdfmake/interfaces';
import type { IntuitAppUrls } from '../lib/qbo/settings';

export interface SetupGuideInput {
  redirectUri: string;
  defaultRedirectUri: string;
  environment: 'sandbox' | 'production';
  appBaseUrl: string;
  configured: boolean;
  envOverride: boolean;
  intuitUrls: IntuitAppUrls;
}

const H_MARGIN: [number, number, number, number] = [0, 14, 0, 4];
const P_MARGIN: [number, number, number, number] = [0, 0, 0, 6];

function h(text: string): Content {
  return { text, bold: true, fontSize: 12, color: '#2c3e50', margin: H_MARGIN };
}
function p(text: string): Content {
  return { text, margin: P_MARGIN, lineHeight: 1.2 };
}
function steps(items: Array<string | Content>): Content {
  return { ol: items, margin: [12, 0, 0, 8], lineHeight: 1.2 };
}
function bullets(items: Array<string | Content>): Content {
  return { ul: items, margin: [12, 0, 0, 8], lineHeight: 1.2 };
}
function code(text: string): Content {
  return {
    table: { widths: ['*'], body: [[{ text, fontSize: 9, color: '#1a1a1a', margin: [6, 4, 6, 4] }]] },
    layout: { fillColor: () => '#f1f5f9', hLineWidth: () => 0, vLineWidth: () => 0 },
    margin: [0, 2, 0, 8],
  };
}
function kv(rows: Array<[string, string]>): Content {
  return {
    table: {
      widths: [150, '*'],
      body: rows.map(([k, v]) => [
        { text: k, bold: true, fontSize: 9, margin: [4, 3, 4, 3] },
        { text: v, fontSize: 9, margin: [4, 3, 4, 3] },
      ]),
    },
    layout: { hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1', hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
    margin: [0, 2, 0, 8],
  };
}

export function buildQboSetupGuideContent(input: SetupGuideInput): Content[] {
  const usingOverride = input.redirectUri !== input.defaultRedirectUri;
  return [
    p(
      'This guide walks an administrator through creating the Intuit developer app that lets Vibe Trial Balance read a ' +
        "client's QuickBooks Online trial balance, and through connecting each client company. The connector is READ-ONLY: " +
        'it never writes to QuickBooks.',
    ),

    h('Values for this installation'),
    p('These are the settings this server is currently using. Copy the redirect URI into the Intuit app exactly as printed — one character of difference and Intuit refuses the connection.'),
    kv([
      ['Redirect URI', input.redirectUri],
      ['Environment', input.environment === 'production' ? 'Production (live company data)' : 'Sandbox (test companies only)'],
      ['App base URL', input.appBaseUrl],
      ['Credentials', input.configured ? (input.envOverride ? 'Set via environment variables' : 'Set on the QuickBooks API page') : 'Not configured yet'],
    ]),
    ...(usingOverride ? [p(`A redirect URI override is in effect. Without it the server would use ${input.defaultRedirectUri}.`)] : []),
    p("Intuit's production checklist (section 5) asks for these addresses. All of them are served by this installation, and the last two need no login:"),
    kv([
      ['Host domain', input.intuitUrls.hostDomain],
      ['Launch URL', input.intuitUrls.launchUrl],
      ['Disconnect URL', input.intuitUrls.disconnectUrl],
      ['Connect / Reconnect URL', input.intuitUrls.connectUrl],
      ['Privacy policy URL', input.intuitUrls.privacyPolicyUrl],
      ['End-user license agreement URL', input.intuitUrls.eulaUrl],
    ]),

    h('1. Create an Intuit developer account and an app'),
    steps([
      'Go to https://developer.intuit.com and sign in with an Intuit account. Any Intuit login works, but use one owned by the firm (not a personal login) so the app survives staff changes.',
      'Open the Dashboard and choose Create an app. Pick QuickBooks Online and Payments as the platform.',
      'Name the app after the firm (for example "Smith CPA – Trial Balance"). The name is what clients see on the Intuit consent screen.',
      'When asked for scopes, select the Accounting scope (com.intuit.quickbooks.accounting). No Payments or OpenID scopes are needed.',
    ]),

    h('2. Sandbox vs. production keys'),
    p(
      'Every Intuit app has two sets of credentials. Development keys only work against Intuit sandbox companies; production keys ' +
        "work against real QuickBooks companies and are released only after Intuit's app assessment (section 5).",
    ),
    bullets([
      'In the app, open Keys & credentials. The Development tab shows the sandbox Client ID and Client Secret; the Production tab shows the live pair once it has been unlocked.',
      'The Environment setting on the QuickBooks API page must match the key set entered: sandbox keys with Sandbox, production keys with Production.',
      'Switching environments invalidates every existing client connection — each client must be reconnected under the new environment.',
    ]),

    h('3. Add the redirect URI to the app'),
    steps([
      'On the same Keys & credentials tab, find Redirect URIs and choose Add URI.',
      `Paste the redirect URI printed above: ${input.redirectUri}`,
      'Save. Add it under Development now and again under Production once those keys are unlocked.',
      'Sandbox accepts http://localhost addresses; production requires a public HTTPS address, which is why an internet-reachable app base URL is needed before going live.',
    ]),

    h('4. Enter the credentials in Vibe Trial Balance'),
    steps([
      'Open Admin → QuickBooks API (administrators only).',
      'Choose the Environment, paste the Client ID and Client Secret, and Save. The secret is stored encrypted and is never shown again; leaving the field blank on a later save keeps the stored value.',
      'Use Redirect URI override only when the address this server derives is not the one the browser actually reaches (for example behind a reverse proxy or a different hostname). Whatever is shown as the effective redirect URI is what must be registered at Intuit.',
      'Press Test. A green result means the Intuit endpoints are reachable and the credentials are accepted; the connector is now configured.',
    ]),

    h('5. Going to production'),
    p(
      'Production keys stay locked until the "App details" and "Compliance" tasks on the Intuit developer dashboard are complete. ' +
        'This installation is a private, unlisted app used by one firm with a read-only accounting scope; it is never published to the QuickBooks App Store, ' +
        'but Intuit still requires every item below. Do them in any order.',
    ),
    p(
      'Before starting, make the server reachable at a public HTTPS address: set APP_BASE_URL (or the redirect URI override on the QuickBooks API page) to it, ' +
        'so every value printed under "Values for this installation" is the public one. Intuit rejects http:// and localhost for production.',
    ),
    steps([
      'Review your Intuit Developer Portal profile and verify the email address. Use the firm-owned login from section 1.',
      "Add your app's end-user license agreement and privacy policy: paste the Privacy policy URL and End-user license agreement URL printed above. " +
        'Both pages are served by this app without a login, and they name the firm from Settings → Firm identity — fill in the firm name, address and contact email there first, or the pages will say the operator has not been named.',
      "Add your app's host domain, launch URL, disconnect URL and connect/reconnect URL: paste the four values printed above. Host domain is the bare domain with no https://. " +
        'The launch and connect URLs open the connections page (a sign-in prompt first is acceptable to Intuit); the disconnect URL is where QuickBooks sends a user who removes the app ' +
        "from a company's My Apps page, and this app then shows that client as Needs re-authorization.",
      'Tell us where your app is hosted: the country and the public IP address (or range) this server calls Intuit from. That is the outbound address of the server or its internet connection — ' +
        'the hosting provider shows it, or run "curl https://api.ipify.org" on the server. A residential connection whose address changes must be updated here when it does.',
      'Complete the App assessment questionnaire. Accurate answers for this installation: a private app used only by the firm and not listed; read-only Accounting scope; no payments; ' +
        "data stored on the firm's own server; OAuth 2.0 with tokens stored encrypted; users disconnect from Setup → QuickBooks or from QuickBooks My Apps.",
      'Register the Redirect URI under the Production tab of Keys & credentials (the same value as section 3 if the public address has not changed).',
      'When Intuit unlocks the Production keys, switch the Environment on the QuickBooks API page to Production, enter the production Client ID and Client Secret, Save and Test. ' +
        'Every existing client connection was made under Sandbox and must be reconnected.',
    ]),

    h('6. Connecting a client company'),
    steps([
      'On Setup → QuickBooks, find the client in the Connections table and press Connect.',
      'The browser goes to Intuit. Sign in with a QuickBooks login that has admin-level access to the client\'s company — a QuickBooks Online Accountant (QBOA) login that lists the client works, as does the client\'s own admin login.',
      'Pick the company and approve the request. Intuit sends the browser back to this server.',
      'Vibe Trial Balance shows the company name it received and asks you to confirm the binding to the client you started from. Press Bind, or Discard if the wrong company was picked (the authorization is revoked at Intuit).',
      'One QuickBooks company per client. Reconnect on a client that already has a company replaces the binding; if a different company is chosen, the stored QuickBooks account links on the chart of accounts are cleared so nothing from the old company matches the new one.',
      'A row showing "Needs re-authorization" means Intuit no longer accepts the stored token (revoked in QuickBooks, expired after long disuse, or the environment changed). Press Reconnect and go through the consent screen again.',
      'Disconnect revokes the token at Intuit and removes the binding; the chart of accounts keeps its QuickBooks account links so a later reconnection to the same company matches immediately.',
    ]),

    h('7. What an import contains'),
    bullets([
      'Trial Balance → Import from QuickBooks pulls the QuickBooks Trial Balance report for the period\'s start and end dates, on the accrual or cash basis you choose (the company\'s default report basis is preselected).',
      'Balances land in the unadjusted columns exactly as QuickBooks states them. Anything already posted in QuickBooks — including adjusting entries made there — is part of that balance; adjustments recorded in Vibe Trial Balance remain separate.',
      'QuickBooks omits accounts with a zero balance. Accounts that carried a balance in an earlier import but are missing now are listed separately in the preview and zeroed when that option is left on.',
      'Accounts are matched by their stored QuickBooks account id, then by the QuickBooks account number against the chart of accounts. Names are never used to match. Anything else is offered as a new account typed from QuickBooks\' classification, or can be pointed at an existing account by hand.',
      'The raw report is kept with the import record so every balance can be traced back to what QuickBooks returned.',
      "PY Tie-Out → Import from QuickBooks pulls the PRIOR year's report instead — the adjacent period's dates when this client has one in the app, otherwise the current period's dates moved back a year — as the bookkeeper's final prior-year balances. QuickBooks reports that year before its close, so expect an offsetting variance between retained earnings and the income and expense accounts; that is the closing entry, not a difference to chase.",
    ]),

    h('8. Troubleshooting'),
    kv([
      ['redirect_uri mismatch / "Something went wrong" at Intuit', 'The effective redirect URI shown on the QuickBooks API page is not registered on the Intuit app for the selected environment. Copy it exactly, including https and the full path.'],
      ['invalid_grant / Needs re-authorization', 'The refresh token was revoked, expired, or belongs to a different environment. Press Reconnect for that client.'],
      ['"Environment mismatch" on a connection', 'The connection was authorized under the other environment. Reconnect after switching.'],
      ['Client Secret rejected on Test', 'Secrets are shown once at Intuit. Generate a new secret on Keys & credentials and paste it again.'],
      ['HTTP 429 / throttled', 'Intuit rate-limits per company. The server retries with backoff; wait a minute and try the import again.'],
      ['Preview says the report totals do not add up', 'The report format changed or contains a row the parser could not read. The import is refused rather than importing a partial balance; report it with the period and company.'],
    ]),
    p('Weekly, the server refreshes every active connection so refresh tokens do not lapse from disuse; a warning is logged when a token is within two weeks of expiry.'),
  ];
}
