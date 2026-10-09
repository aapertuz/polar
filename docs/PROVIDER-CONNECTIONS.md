# Local provider connections

Polar currently implements ChatGPT connection management and an explicit inference
test. Open the desktop launcher, choose **Settings**, and select **Continue with
ChatGPT**. Sign in and grant access in the system browser, return to Polar, choose
a model, and select **Test connection**. Keep Polar and Settings open during
browser sign-in, MFA, and consent; the callback listener waits up to 30 minutes.
If it expires, is cancelled, or the app restarts, start a fresh sign-in from
Settings rather than reloading the old callback page. This sends only a short confirmation
prompt and uses the selected account's ChatGPT allowance.

Quick AI uses the selected connected ChatGPT account and model for mission
clarification and planning. The desktop sends inference through Rust; provider
credentials stay in the OS credential store, and Polar does not fall back to a
paid API key or another provider. Mission drafts, selected extracted context,
proposals, and activation state sync to the authenticated development or
production Polar server configured for that build. Original documents remain
local. Claude subscription login is unavailable pending Anthropic approval for
third-party products. Open-source distribution alone does not establish that
approval; see the
[Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview).

## Accounts and credentials

Rust owns authentication and provider requests in
[`native/src-tauri/src/providers/`](../native/src-tauri/src/providers/).
React receives account labels, connection status, available models, and static
error messages. Tokens never enter React, browser storage, or the Fastify server.
The browser-only preview cannot connect accounts.

OAuth uses a temporary IPv4 loopback listener, random state and nonce, and PKCE
S256. Rust validates the signed identity token, issuer, audience, expiry, nonce,
and returning account subject. Provider discovery URLs are restricted to the
OpenAI authentication origin; HTTP redirects are disabled. Initial authorization
uses `dynamic_agent_client`, then retains the issued client ID for token exchange,
renewal, and reconnect. An expired authorization code triggers one fresh browser
authorization using that issued registration.

The OS credential store holds the stable opaque host ID, issued client mappings,
account identity, model choice, and token sets in one protected record. There is
no plaintext fallback. On macOS this uses Keychain. Windows Credential Manager
and Linux Secret Service backends are configured but have not been validated on
those platforms. Keep release support limited to tested platforms.

Saved registrations remain separate even when email addresses match. Disconnect
clears the selected registration's local tokens and model, while preserving its
identity and client mapping for reconnect. It also attempts remote refresh-token
revocation; an unconfirmed revocation is reported explicitly. The ChatGPT usage
link opens [ChatGPT Settings → Usage](https://chatgpt.com/settings/usage), where the
user can manage app access and limits. Up to 20 registrations can be saved.

OS credential reads run on a blocking worker and return a cancellation or
30-second timeout message if the OS is waiting for access. The lock stays with
that worker until the OS read finishes, so retries cannot race it. Unlock or
resolve any system credential prompt before reloading; rebuilding an unsigned
app can require renewed Keychain access.

A process mutex and an OS file lock serialize access to the credential record.
The lock file in Tauri's app-data directory contains no credentials. Refresh
tokens rotate as one replacement record. Cancellation waits for any in-flight
refresh to finish saving its replacement before stopping subsequent work, which
can take up to the HTTP request timeout. Disconnect cancels current local work
and waits for that protected operation before clearing credentials. Another
Polar process holding the lock produces an actionable busy error.

## Inference and failures

The selected account's public model catalog determines selectable models; server
order is preserved. Model selection and testing verify catalog availability.
The test streams a fixed prompt to the public Responses API with `store: false`
and requires text plus a successful `response.completed` event. Partial output,
incomplete events, malformed streams, and late quota errors fail the test.
The request explicitly asks for SSE. If a gateway supplies a different media
type, the reader still validates bounded SSE data; a JSON error or a normal
non-streaming JSON response cannot pass as completed streaming inference.
Requests and response buffers are bounded. No failure switches to paid API keys.

Use **Reconnect** after expired or revoked access, **Reload** after temporary
network failures, or another account/model when access is unavailable. Quota
errors direct the user to ChatGPT usage settings. Closing Settings cancels its
current operation; cancelled sign-in does not save an account.

These contracts follow OpenAI's
[sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in),
[session lifecycle](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions),
and [models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
documentation. The integration is a preview; release still requires the remaining live session
lifecycle checks below.

## Verification limits

Rust regression tests cover OAuth callback rejection, signed identity validation,
scope checks, refresh-record replacement, protected-store reload/failure behavior,
operation locking, cancellation, and streaming success/failure parsing. The RSA
keys in `providers/fixtures/` are disposable test keys, used only by unit tests;
they are not production credentials or trusted provider keys. Store unit tests
use keyring's isolated mock credential and do not establish OS-backend behavior.

See the [verification checklist](VERIFICATION.md#provider-connection-smoke-review)
for desktop and live-account checks. On 2026-10-07, user-completed OAuth consent, authenticated model listing,
account/model restoration after app restart, and completed test inference were
verified in the macOS desktop app. Real token renewal, reconnect, multiple
registrations, and remote revocation still require live verification. The earlier
intermittent Keychain wait remains a robustness follow-up.
