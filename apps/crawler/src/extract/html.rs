use super::{ExtractedPage, HeadingHierarchy};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn extract_html(
    doc_id: String,
    url: String,
    payload: &[u8],
    response_headers: &BTreeMap<String, String>,
) -> Result<ExtractedPage, String> {
    let html = String::from_utf8_lossy(payload).to_string();
    if html.trim().is_empty() {
        return Err("empty html payload".to_string());
    }

    let title = first_tag_text(&html, "title");
    let h1 = all_tag_text(&html, "h1");
    let h2 = all_tag_text(&html, "h2");
    let h3 = all_tag_text(&html, "h3");

    let code_blocks = all_tag_text(&html, "code");
    let tables = all_tag_text(&html, "table");
    let admonitions = collect_admonitions(&html);

    let canonical_url = first_attr_value(&html, "link", "rel", "canonical", "href");

    let body_raw = first_tag_text(&html, "main")
        .or_else(|| first_tag_text(&html, "article"))
        .unwrap_or_else(|| strip_html_tags(&html));
    let main_body = normalize_text(&body_raw);

    let last_modified = response_headers
        .get("last-modified")
        .cloned()
        .or_else(|| first_attr_value(&html, "meta", "http-equiv", "last-modified", "content"))
        .or_else(|| first_attr_value(&html, "meta", "name", "last-modified", "content"));

    let needs_render = looks_js_heavy(&html) || main_body.len() < 120;

    let mut metadata = BTreeMap::new();
    metadata.insert("content_type".to_string(), "text/html".to_string());
    metadata.insert("extractor".to_string(), "html".to_string());

    Ok(ExtractedPage {
        doc_id,
        url,
        canonical_url,
        title,
        headings: HeadingHierarchy { h1, h2, h3 },
        main_body,
        code_blocks: code_blocks
            .into_iter()
            .map(|s| normalize_text(&strip_html_tags(&s)))
            .filter(|s| !s.is_empty())
            .collect(),
        tables: tables
            .into_iter()
            .map(|s| normalize_text(&strip_html_tags(&s)))
            .filter(|s| !s.is_empty())
            .collect(),
        admonitions,
        last_modified,
        needs_render,
        extracted_at_ts: now_ts(),
        metadata,
    })
}

fn first_tag_text(input: &str, tag: &str) -> Option<String> {
    all_tag_text(input, tag).into_iter().next().map(|s| normalize_text(&strip_html_tags(&s)))
}

fn all_tag_text(input: &str, tag: &str) -> Vec<String> {
    let mut out = Vec::new();
    let open = format!("<{}", tag);
    let close = format!("</{}>", tag);
    let mut i = 0;

    while let Some(start_rel) = input[i..].find(&open) {
        let start = i + start_rel;
        let after_open = match input[start..].find('>') {
            Some(pos) => start + pos + 1,
            None => break,
        };
        let end = match input[after_open..].find(&close) {
            Some(pos) => after_open + pos,
            None => break,
        };
        out.push(input[after_open..end].to_string());
        i = end + close.len();
    }

    out
}

fn first_attr_value(
    html: &str,
    tag: &str,
    attr_key: &str,
    attr_value: &str,
    target_attr: &str,
) -> Option<String> {
    let needle = format!("<{}", tag);
    let mut i = 0;
    while let Some(start_rel) = html[i..].find(&needle) {
        let start = i + start_rel;
        let end = match html[start..].find('>') {
            Some(pos) => start + pos,
            None => break,
        };
        let tag_chunk = &html[start..=end];
        if attr_contains(tag_chunk, attr_key, attr_value) {
            if let Some(v) = attr_extract(tag_chunk, target_attr) {
                return Some(v);
            }
        }
        i = end + 1;
    }

    None
}

fn attr_contains(tag_chunk: &str, key: &str, expected: &str) -> bool {
    attr_extract(tag_chunk, key)
        .map(|v| v.to_ascii_lowercase().contains(&expected.to_ascii_lowercase()))
        .unwrap_or(false)
}

fn attr_extract(tag_chunk: &str, key: &str) -> Option<String> {
    let key_eq = format!("{}=", key);
    let idx = tag_chunk.to_ascii_lowercase().find(&key_eq)?;
    let rest = &tag_chunk[idx + key_eq.len()..];
    let mut chars = rest.chars();
    let quote = chars.next()?;
    if quote != '"' && quote != '\'' {
        return None;
    }
    let inner = &rest[1..];
    let end = inner.find(quote)?;
    Some(inner[..end].to_string())
}

fn collect_admonitions(html: &str) -> Vec<String> {
    let mut out = Vec::new();
    for class_name in ["admonition", "alert", "note", "warning", "tip"] {
        let mut i = 0;
        while let Some(idx) = html[i..].to_ascii_lowercase().find(class_name) {
            let absolute = i + idx;
            let start = absolute.saturating_sub(80);
            let end = usize::min(absolute + 260, html.len());
            out.push(normalize_text(&strip_html_tags(&html[start..end])));
            i = end;
        }
    }
    out.into_iter().filter(|s| s.len() > 15).collect()
}

fn strip_html_tags(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut inside = false;
    for c in input.chars() {
        match c {
            '<' => inside = true,
            '>' => inside = false,
            _ if !inside => out.push(c),
            _ => {}
        }
    }
    out
}

fn normalize_text(input: &str) -> String {
    input
        .split_whitespace()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn looks_js_heavy(html: &str) -> bool {
    let scripts = html.to_ascii_lowercase().matches("<script").count();
    let has_root = html.contains("id=\"root\"") || html.contains("id='root'");
    scripts >= 8 || has_root
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
