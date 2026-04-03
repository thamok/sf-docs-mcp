use super::{ExtractedPage, HeadingHierarchy};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn extract_pdf(
    doc_id: String,
    url: String,
    payload: &[u8],
    response_headers: &BTreeMap<String, String>,
) -> Result<ExtractedPage, String> {
    if payload.is_empty() {
        return Err("empty pdf payload".to_string());
    }

    // Lightweight best-effort extraction; replace with a full parser when available.
    let lossy = String::from_utf8_lossy(payload);
    let body = extract_printable_text(&lossy);
    if body.trim().is_empty() {
        return Err("pdf text extraction produced no body".to_string());
    }

    let title = response_headers
        .get("x-document-title")
        .cloned()
        .or_else(|| body.lines().next().map(str::to_string));

    let headings = infer_headings(&body);

    let mut metadata = BTreeMap::new();
    metadata.insert("content_type".to_string(), "application/pdf".to_string());
    metadata.insert("extractor".to_string(), "pdf".to_string());

    Ok(ExtractedPage {
        doc_id,
        url,
        canonical_url: None,
        title,
        headings,
        main_body: body,
        code_blocks: Vec::new(),
        tables: Vec::new(),
        admonitions: Vec::new(),
        last_modified: response_headers.get("last-modified").cloned(),
        needs_render: false,
        extracted_at_ts: now_ts(),
        metadata,
    })
}

fn extract_printable_text(input: &str) -> String {
    input
        .chars()
        .map(|c| if c.is_ascii_graphic() || c.is_ascii_whitespace() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn infer_headings(body: &str) -> HeadingHierarchy {
    let mut h1 = Vec::new();
    let mut h2 = Vec::new();
    let mut h3 = Vec::new();

    for line in body.split('.') {
        let trimmed = line.trim();
        if trimmed.len() > 6 && trimmed.len() < 80 && trimmed.chars().all(|c| !c.is_lowercase()) {
            if h1.is_empty() {
                h1.push(trimmed.to_string());
            } else if h2.len() < 12 {
                h2.push(trimmed.to_string());
            } else {
                h3.push(trimmed.to_string());
            }
        }
    }

    HeadingHierarchy { h1, h2, h3 }
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
