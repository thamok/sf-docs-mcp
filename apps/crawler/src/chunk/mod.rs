use crate::extract::ExtractedPage;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

const TARGET_MIN_TOKENS: usize = 400;
const TARGET_MAX_TOKENS: usize = 900;
const OVERLAP_MIN_TOKENS: usize = 80;
const OVERLAP_MAX_TOKENS: usize = 150;

#[derive(Debug, Clone)]
pub struct Section {
    pub section_path: String,
    pub headings: Vec<String>,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct PageRecord {
    pub doc_id: String,
    pub canonical_url: Option<String>,
    pub full_text: String,
    pub content_hash: String,
    pub created_at_ts: u64,
    pub updated_at_ts: u64,
}

#[derive(Debug, Clone)]
pub struct ChunkRecord {
    pub doc_id: String,
    pub chunk_id: String,
    pub section_path: String,
    pub headings: Vec<String>,
    pub content: String,
    pub content_hash: String,
    pub created_at_ts: u64,
    pub updated_at_ts: u64,
}

#[derive(Debug, Clone, Default)]
pub struct InMemoryPersistence {
    pub pages: Vec<PageRecord>,
    pub chunks: Vec<ChunkRecord>,
}

impl InMemoryPersistence {
    pub fn persist_page_and_chunks(&mut self, page: &ExtractedPage) {
        let now = now_ts();
        let full_text = page.full_text();
        let page_hash = hash_text(&full_text);

        self.pages.push(PageRecord {
            doc_id: page.doc_id.clone(),
            canonical_url: page.canonical_url.clone(),
            full_text,
            content_hash: page_hash,
            created_at_ts: now,
            updated_at_ts: now,
        });

        let sections = sectionize_by_headings(page);
        let chunks = chunk_sections(&page.doc_id, &sections);
        self.chunks.extend(chunks);
    }
}

pub fn sectionize_by_headings(page: &ExtractedPage) -> Vec<Section> {
    let mut sections = Vec::new();
    let mut active_path = vec![page.title.clone().unwrap_or_else(|| "Document".to_string())];

    for raw_line in page.main_body.lines() {
        let line = raw_line.trim();
        if line.is_empty() {
            continue;
        }

        if page.headings.h1.iter().any(|h| h == line) {
            active_path = vec![line.to_string()];
            sections.push(Section {
                section_path: active_path.join(" > "),
                headings: active_path.clone(),
                text: String::new(),
            });
            continue;
        }

        if page.headings.h2.iter().any(|h| h == line) {
            if active_path.len() > 1 {
                active_path.truncate(1);
            }
            active_path.push(line.to_string());
            sections.push(Section {
                section_path: active_path.join(" > "),
                headings: active_path.clone(),
                text: String::new(),
            });
            continue;
        }

        if page.headings.h3.iter().any(|h| h == line) {
            if active_path.len() > 2 {
                active_path.truncate(2);
            }
            active_path.push(line.to_string());
            sections.push(Section {
                section_path: active_path.join(" > "),
                headings: active_path.clone(),
                text: String::new(),
            });
            continue;
        }

        if sections.is_empty() {
            sections.push(Section {
                section_path: active_path.join(" > "),
                headings: active_path.clone(),
                text: String::new(),
            });
        }

        if let Some(last) = sections.last_mut() {
            if !last.text.is_empty() {
                last.text.push('\n');
            }
            last.text.push_str(line);
        }
    }

    sections.into_iter().filter(|s| !s.text.trim().is_empty()).collect()
}

pub fn chunk_sections(doc_id: &str, sections: &[Section]) -> Vec<ChunkRecord> {
    let now = now_ts();
    let mut out = Vec::new();

    for (section_ix, section) in sections.iter().enumerate() {
        let words = section
            .text
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>();
        if words.is_empty() {
            continue;
        }

        let mut offset = 0usize;
        let mut piece_ix = 0usize;

        while offset < words.len() {
            let remaining = words.len() - offset;
            let take = if remaining <= TARGET_MAX_TOKENS {
                remaining
            } else {
                TARGET_MAX_TOKENS
            };

            let end = offset + take;
            let content = words[offset..end].join(" ");
            let chunk_id = format!("{}:{}:{}", doc_id, section_ix, piece_ix);

            out.push(ChunkRecord {
                doc_id: doc_id.to_string(),
                chunk_id,
                section_path: section.section_path.clone(),
                headings: section.headings.clone(),
                content_hash: hash_text(&content),
                content,
                created_at_ts: now,
                updated_at_ts: now,
            });

            if end >= words.len() {
                break;
            }

            let overlap = overlap_size(take);
            offset = end.saturating_sub(overlap);
            piece_ix += 1;
        }
    }

    out
}

fn overlap_size(chunk_size: usize) -> usize {
    if chunk_size < TARGET_MIN_TOKENS {
        return 0;
    }

    let candidate = chunk_size / 6;
    candidate.clamp(OVERLAP_MIN_TOKENS, OVERLAP_MAX_TOKENS)
}

fn hash_text(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
