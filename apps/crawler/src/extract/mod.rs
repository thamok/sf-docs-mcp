pub mod html;
pub mod pdf;

use std::collections::BTreeMap;

#[derive(Debug, Clone, Default)]
pub struct HeadingHierarchy {
    pub h1: Vec<String>,
    pub h2: Vec<String>,
    pub h3: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ExtractedPage {
    pub doc_id: String,
    pub url: String,
    pub canonical_url: Option<String>,
    pub title: Option<String>,
    pub headings: HeadingHierarchy,
    pub main_body: String,
    pub code_blocks: Vec<String>,
    pub tables: Vec<String>,
    pub admonitions: Vec<String>,
    pub last_modified: Option<String>,
    pub needs_render: bool,
    pub extracted_at_ts: u64,
    pub metadata: BTreeMap<String, String>,
}

impl ExtractedPage {
    pub fn full_text(&self) -> String {
        [
            self.title.clone().unwrap_or_default(),
            self.main_body.clone(),
            self.code_blocks.join("\n\n"),
            self.tables.join("\n\n"),
            self.admonitions.join("\n\n"),
        ]
        .into_iter()
        .filter(|s| !s.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
    }
}

#[derive(Debug)]
pub enum ExtractorError {
    UnsupportedContentType(String),
    ParseFailed(String),
}

pub fn extract_page(
    doc_id: impl Into<String>,
    url: impl Into<String>,
    content_type: &str,
    payload: &[u8],
    response_headers: &BTreeMap<String, String>,
) -> Result<ExtractedPage, ExtractorError> {
    let doc_id = doc_id.into();
    let url = url.into();
    let content_type_lc = content_type.to_ascii_lowercase();

    if content_type_lc.contains("text/html") || content_type_lc.contains("application/xhtml+xml") {
        return match html::extract_html(doc_id.clone(), url.clone(), payload, response_headers) {
            Ok(page) => Ok(page),
            Err(err) => Ok(needs_render_fallback(doc_id, url, content_type, err)),
        };
    }

    if content_type_lc.contains("application/pdf") {
        return match pdf::extract_pdf(doc_id.clone(), url.clone(), payload, response_headers) {
            Ok(page) => Ok(page),
            Err(err) => Ok(needs_render_fallback(doc_id, url, content_type, err)),
        };
    }

    Err(ExtractorError::UnsupportedContentType(content_type.to_string()))
}

fn needs_render_fallback(doc_id: String, url: String, content_type: &str, reason: String) -> ExtractedPage {
    let mut metadata = BTreeMap::new();
    metadata.insert("content_type".to_string(), content_type.to_string());
    metadata.insert("extractor_error".to_string(), reason);

    ExtractedPage {
        doc_id,
        url,
        needs_render: true,
        extracted_at_ts: 0,
        metadata,
        ..Default::default()
    }
}
