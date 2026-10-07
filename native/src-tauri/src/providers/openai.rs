use super::{oauth, store, types::*};
use futures_util::StreamExt;
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::Value;

const MAX_RESPONSE: usize = 2 * 1024 * 1024;

pub fn remote_error(status: u16, code: Option<&str>) -> ProviderError {
    match code {
        Some("subscription_sharing_usage_limit_exceeded") => ProviderError::new("quota", "The ChatGPT plan limit for Polar has been reached. Review your app limit in ChatGPT Settings → Usage."),
        Some("subscription_sharing_usage_unavailable") => ProviderError::new("plan_unavailable", "ChatGPT plan usage is unavailable for this account or workspace. Review your ChatGPT settings or choose another account."),
        Some("invalid_grant" | "invalid_token") => ProviderError::new("reauth_required", "Your ChatGPT session has expired or been revoked. Reconnect this account."),
        Some("slow_down") => ProviderError::new("rate_limit", "ChatGPT asked Polar to wait before renewing access. Try again shortly."),
        _ if status == 401 => ProviderError::new("reauth_required", "Your ChatGPT session is no longer valid. Reconnect this account."),
        _ if status == 403 => ProviderError::new("plan_permission", "This ChatGPT account does not permit this request. Review app access in ChatGPT settings."),
        _ if status == 429 => ProviderError::new("rate_limit", "ChatGPT is limiting requests. Wait before trying again."),
        _ if status >= 500 => ProviderError::new("provider_unavailable", "ChatGPT is temporarily unavailable. Try again later."),
        _ => ProviderError::new("provider_error", "ChatGPT could not complete this request. Try reconnecting or select another model."),
    }
}

pub async fn bytes(response: reqwest::Response) -> Result<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE as u64)
    {
        return Err(ProviderError::protocol());
    }
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| ProviderError::network())?;
        if body.len().saturating_add(chunk.len()) > MAX_RESPONSE {
            return Err(ProviderError::protocol());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

pub async fn json<T: DeserializeOwned>(response: reqwest::Response) -> Result<T> {
    let status = response.status();
    let body = bytes(response).await?;
    if !status.is_success() {
        let value: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
        let code = value
            .get("error")
            .and_then(Value::as_str)
            .or_else(|| value.pointer("/error/code").and_then(Value::as_str));
        return Err(remote_error(status.as_u16(), code));
    }
    serde_json::from_slice(&body).map_err(|_| ProviderError::protocol())
}

pub async fn access(client: &reqwest::Client, vault: &mut Vault) -> Result<String> {
    let registration = vault.active()?.clone();
    let credentials = registration
        .credentials
        .as_ref()
        .ok_or_else(|| ProviderError::new("not_connected", "Reconnect this ChatGPT account."))?;
    if !credentials.scopes.iter().any(|scope| scope == PLAN_SCOPE) {
        return Err(ProviderError::new(
            "plan_permission",
            "Reconnect and grant ChatGPT plan access.",
        ));
    }
    if credentials.expires_at > now().saturating_add(60) {
        return Ok(credentials.access_token.clone());
    }
    if credentials
        .earliest_refresh_at
        .is_some_and(|earliest| now() < earliest)
    {
        if credentials.expires_at > now() {
            return Ok(credentials.access_token.clone());
        }
        return Err(ProviderError::new(
            "rate_limit",
            "ChatGPT access cannot be renewed yet. Try again shortly.",
        ));
    }
    let fresh = oauth::refresh(client, &registration).await?;
    let token = fresh.access_token.clone();
    let record = vault
        .registrations
        .iter_mut()
        .find(|r| r.id == registration.id)
        .ok_or_else(ProviderError::protocol)?;
    record.credentials = Some(fresh);
    // One native operation at a time prevents rotating refresh tokens from racing.
    store::save(vault)?;
    Ok(token)
}

#[derive(Deserialize)]
struct Catalog {
    models: Vec<CatalogModel>,
}
#[derive(Deserialize)]
struct CatalogModel {
    slug: String,
    display_name: String,
    visibility: String,
}

pub async fn models(client: &reqwest::Client, access_token: &str) -> Result<Vec<Model>> {
    let response = client
        .get(format!("{RESOURCE}/models"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| ProviderError::network())?;
    let catalog: Catalog = json(response).await?;
    let mut models = Vec::new();
    for model in catalog
        .models
        .into_iter()
        .filter(|m| m.visibility == "list")
    {
        if model.slug.is_empty() || model.slug.len() > 256 || model.display_name.len() > 256 {
            return Err(ProviderError::protocol());
        }
        if !models.iter().any(|m: &Model| m.slug == model.slug) {
            models.push(Model {
                slug: model.slug,
                display_name: model.display_name,
            });
        }
    }
    Ok(models)
}

#[derive(Default)]
pub struct TestStream {
    pending: Vec<u8>,
    event_lines: Vec<String>,
    event_size: usize,
    text: String,
    completed: bool,
}

impl TestStream {
    pub fn feed(&mut self, chunk: &[u8]) -> Result<()> {
        if self.pending.len().saturating_add(chunk.len()) > MAX_RESPONSE {
            return Err(ProviderError::protocol());
        }
        self.pending.extend_from_slice(chunk);
        while let Some(end) = self.pending.iter().position(|byte| *byte == b'\n') {
            let line: Vec<u8> = self.pending.drain(..=end).collect();
            let line = std::str::from_utf8(&line)
                .map_err(|_| {
                    ProviderError::new(
                        "stream_encoding",
                        "The ChatGPT test stream was not valid UTF-8.",
                    )
                })?
                .trim_end_matches(['\r', '\n']);
            if line.is_empty() {
                self.flush()?;
            } else if let Some(data) = line.strip_prefix("data:") {
                self.event_size = self.event_size.saturating_add(data.len());
                if self.event_size > MAX_RESPONSE {
                    return Err(ProviderError::protocol());
                }
                self.event_lines
                    .push(data.strip_prefix(' ').unwrap_or(data).to_string());
            }
        }
        Ok(())
    }
    fn flush(&mut self) -> Result<()> {
        if self.event_lines.is_empty() {
            return Ok(());
        }
        let data = self.event_lines.join("\n");
        self.event_lines.clear();
        self.event_size = 0;
        if data == "[DONE]" {
            return Ok(());
        }
        let value: Value = serde_json::from_str(&data).map_err(|_| {
            ProviderError::new(
                "stream_json",
                "The ChatGPT test stream contained invalid event JSON.",
            )
        })?;
        match value.get("type").and_then(Value::as_str) {
            Some("response.output_text.delta") => {
                let delta = value.get("delta").and_then(Value::as_str).ok_or_else(|| {
                    ProviderError::new(
                        "stream_delta",
                        "The ChatGPT test stream contained an invalid text event.",
                    )
                })?;
                if self.text.len().saturating_add(delta.len()) > 8192 {
                    return Err(ProviderError::protocol());
                }
                self.text.push_str(delta);
            }
            Some("response.completed") => {
                if value.pointer("/response/status").and_then(Value::as_str) != Some("completed") {
                    return Err(ProviderError::new(
                        "stream_terminal",
                        "ChatGPT sent a completion event without a completed response status.",
                    ));
                }
                self.completed = true;
            }
            Some("response.failed" | "error") => {
                return Err(remote_error(
                    400,
                    value
                        .pointer("/response/error/code")
                        .or_else(|| value.pointer("/error/code"))
                        .or_else(|| value.get("code"))
                        .and_then(Value::as_str),
                ))
            }
            Some("response.incomplete") => {
                return Err(ProviderError::new(
                    "incomplete",
                    "ChatGPT did not complete the test. Try again or select another model.",
                ))
            }
            _ => {}
        }
        Ok(())
    }
    pub fn finish(mut self) -> Result<String> {
        if !self.pending.is_empty()
            || !self.event_lines.is_empty()
            || !self.completed
            || self.text.trim().is_empty()
        {
            return Err(ProviderError::new(
                "interrupted",
                "The ChatGPT test ended before a complete response. Try again.",
            ));
        }
        Ok(std::mem::take(&mut self.text))
    }
}

pub async fn test(client: &reqwest::Client, access_token: &str, model: &str) -> Result<String> {
    let response = client
        .post(format!("{RESOURCE}/responses"))
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .bearer_auth(access_token)
        .json(&serde_json::json!({
            "model": model,
            "instructions": "This is a connection test. Reply briefly with: Polar is connected.",
            "input": [{"role":"user", "content":"Confirm this connection."}],
            "store": false, "stream": true,
        }))
        .send()
        .await
        .map_err(|_| ProviderError::network())?;
    read_test_response(response).await
}

async fn read_test_response(response: reqwest::Response) -> Result<String> {
    if !response.status().is_success() {
        let _: Value = json(response).await?;
        return Err(ProviderError::protocol());
    }
    if !response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|s| s.to_str().ok())
        .is_some_and(|s| s.starts_with("text/event-stream"))
    {
        // Some gateways label an SSE body with another media type. Validate the
        // bounded event payload instead of rejecting solely on that header.
        let body = bytes(response).await?;
        if let Ok(value) = serde_json::from_slice::<Value>(&body) {
            if value.get("error").is_some() {
                return Err(remote_error(
                    400,
                    value.pointer("/error/code").and_then(Value::as_str),
                ));
            }
            return Err(ProviderError::new(
                "stream_content_type",
                "ChatGPT returned JSON instead of streaming events for the test.",
            ));
        }
        let mut test = TestStream::default();
        test.feed(&body)?;
        return test.finish();
    }
    let mut stream = response.bytes_stream();
    let mut test = TestStream::default();
    let mut total = 0usize;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| ProviderError::network())?;
        total = total.saturating_add(chunk.len());
        if total > MAX_RESPONSE {
            return Err(ProviderError::protocol());
        }
        test.feed(&chunk)?;
    }
    test.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn response_with_body(content_type: &str, body: &str) -> reqwest::Response {
        axum::http::Response::builder()
            .status(200)
            .header(reqwest::header::CONTENT_TYPE, content_type)
            .body(reqwest::Body::from(body.to_string()))
            .unwrap()
            .into()
    }
    #[tokio::test]
    async fn completed_event_stream_is_valid_even_when_gateway_mislabels_content_type() {
        let body = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Connected\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n\n";
        for content_type in [
            "text/event-stream",
            "application/json",
            "application/octet-stream",
        ] {
            assert_eq!(
                read_test_response(response_with_body(content_type, body))
                    .await
                    .unwrap(),
                "Connected"
            );
        }
    }
    #[tokio::test]
    async fn json_errors_and_non_streaming_success_are_not_successful_test_streams() {
        let quota = r#"{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}"#;
        assert_eq!(
            read_test_response(response_with_body("application/json", quota))
                .await
                .unwrap_err()
                .code,
            "quota"
        );
        let complete = r#"{"status":"completed","output":[]}"#;
        assert_eq!(
            read_test_response(response_with_body("application/json", complete))
                .await
                .unwrap_err()
                .code,
            "stream_content_type"
        );
    }
    #[test]
    fn fragmented_utf8_and_crlf_stream_completes() {
        let body = "data: {\"type\":\"response.output_text.delta\",\"delta\":\"Connected ✓\"}\r\n\r\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\r\n\r\n";
        let mut stream = TestStream::default();
        for byte in body.as_bytes() {
            stream.feed(&[*byte]).unwrap();
        }
        assert_eq!(stream.finish().unwrap(), "Connected ✓");
    }
    #[test]
    fn partial_text_does_not_pass_and_late_quota_error_wins() {
        let mut stream = TestStream::default();
        stream
            .feed(b"data: {\"type\":\"response.output_text.delta\",\"delta\":\"hello\"}\n\n")
            .unwrap();
        assert_eq!(stream.finish().unwrap_err().code, "interrupted");
        let mut stream = TestStream::default();
        stream.feed(b"data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n\n").unwrap();
        let error = stream.feed(b"data: {\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"subscription_sharing_usage_limit_exceeded\"}}}\n\n").unwrap_err();
        assert_eq!(error.code, "quota");
    }
    #[test]
    fn malformed_incomplete_and_truncated_streams_fail() {
        for body in [
            b"data: not-json\n\n".as_slice(),
            b"data: {\"type\":\"response.incomplete\"}\n\n",
            b"data: {\"type\":\"response.completed\",\"response\":{\"status\":\"failed\"}}\n\n",
        ] {
            assert!(TestStream::default().feed(body).is_err());
        }
        let mut stream = TestStream::default();
        stream
            .feed(b"data: {\"type\":\"response.completed\"}")
            .unwrap();
        assert!(stream.finish().is_err());
    }
    #[test]
    fn remote_errors_do_not_echo_sensitive_provider_messages() {
        assert_eq!(remote_error(401, None).code, "reauth_required");
        assert_eq!(
            remote_error(400, Some("invalid_grant")).code,
            "reauth_required"
        );
        assert_eq!(
            remote_error(400, Some("subscription_sharing_usage_unavailable")).code,
            "plan_unavailable"
        );
    }
}
