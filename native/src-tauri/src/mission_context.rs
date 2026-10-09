use quick_xml::events::Event;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    io::{Cursor, Read},
    path::PathBuf,
};
use tauri_plugin_dialog::DialogExt;

const MAX_FILES: usize = 10;
const MAX_FILE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: usize = 1024 * 1024;
const MAX_DOCX_XML_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedSource {
    pub id: String,
    pub file_name: String,
    pub content_hash: String,
    pub extracted_text: String,
    pub provenance: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub sources: Vec<ImportedSource>,
    pub failures: Vec<ImportFailure>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFailure {
    pub file_name: String,
    pub message: String,
}

#[tauri::command]
pub async fn polar_import_mission_context(app: tauri::AppHandle) -> Result<ImportResult, String> {
    import_context(app, "Mission context").await
}

#[tauri::command]
pub async fn polar_import_workspace_context(app: tauri::AppHandle) -> Result<ImportResult, String> {
    import_context(app, "Workspace context").await
}

async fn import_context(
    app: tauri::AppHandle,
    label: &'static str,
) -> Result<ImportResult, String> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter(label, &["pdf", "docx", "md", "markdown", "txt"])
            .blocking_pick_files()
    })
    .await
    .map_err(|_| "Polar could not open the file picker. Try again.".to_string())?;
    let Some(selected) = selected else {
        return Ok(ImportResult {
            sources: vec![],
            failures: vec![],
        });
    };
    if selected.len() > MAX_FILES {
        return Err("Choose no more than 10 files at a time.".to_string());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut result = ImportResult {
            sources: vec![],
            failures: vec![],
        };
        for file in selected {
            let path = match file.into_path() {
                Ok(path) => path,
                Err(_) => {
                    result.failures.push(ImportFailure {
                        file_name: "Selected file".into(),
                        message:
                            "Polar could not read this file. Check its local permissions and retry."
                                .into(),
                    });
                    continue;
                }
            };
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Selected file")
                .to_string();
            match import_file(&path) {
                Ok(source) => result.sources.push(source),
                Err(message) => result.failures.push(ImportFailure {
                    file_name: name,
                    message,
                }),
            }
        }
        Ok(result)
    })
    .await
    .map_err(|_| "Polar could not read the selected files. Try again.".to_string())?
}

fn import_file(path: &PathBuf) -> Result<ImportedSource, String> {
    let metadata = std::fs::metadata(path)
        .map_err(|_| "Polar could not read this file. Check its local permissions.".to_string())?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > MAX_FILE_BYTES {
        return Err("This file is empty or larger than the 20 MiB limit.".into());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let provenance = match extension.as_str() {
        "pdf" => "pdf",
        "docx" => "docx",
        "md" | "markdown" => "markdown",
        "txt" => "text",
        _ => return Err("Supported formats are text PDF, DOCX, Markdown, and plain text.".into()),
    };
    let bytes = std::fs::read(path)
        .map_err(|_| "Polar could not read this file. Check its local permissions.".to_string())?;
    let text = match provenance {
        "pdf" => {
            let pages = pdf_extract::extract_text_from_mem_by_pages(&bytes).map_err(|_| "Polar could not extract text. This PDF may be encrypted, corrupt, or scanned without selectable text.".to_string())?;
            pages
                .iter()
                .enumerate()
                .map(|(index, page)| format!("[Page {}]\n{}", index + 1, page))
                .collect::<Vec<_>>()
                .join("\n\n")
        }
        "docx" => extract_docx(&bytes)?,
        _ => std::str::from_utf8(&bytes)
            .map_err(|_| "This text file is not valid UTF-8.".to_string())?
            .trim_start_matches('\u{feff}')
            .to_string(),
    };
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err(
            "No selectable text was found. Scanned PDFs and images are not supported yet.".into(),
        );
    }
    if text.len() > MAX_EXTRACTED_BYTES {
        return Err("Extracted text is larger than the 1 MiB per-source limit.".into());
    }
    let content_hash = hex::encode(Sha256::digest(text.as_bytes()));
    Ok(ImportedSource {
        id: uuid::Uuid::new_v4().to_string(),
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Context file")
            .chars()
            .take(255)
            .collect(),
        content_hash,
        extracted_text: text,
        provenance: provenance.into(),
    })
}

fn extract_docx(bytes: &[u8]) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| "This DOCX file is corrupt or encrypted.".to_string())?;
    let document = archive
        .by_name("word/document.xml")
        .map_err(|_| "This DOCX file has no readable document body.".to_string())?;
    if document.size() > MAX_DOCX_XML_BYTES {
        return Err("This DOCX expands beyond the 5 MiB document limit.".into());
    }
    let mut xml = Vec::with_capacity(document.size() as usize);
    document
        .take(MAX_DOCX_XML_BYTES + 1)
        .read_to_end(&mut xml)
        .map_err(|_| "Polar could not read the DOCX document body.".to_string())?;
    if xml.len() as u64 > MAX_DOCX_XML_BYTES {
        return Err("This DOCX expands beyond the 5 MiB document limit.".into());
    }
    let mut reader = quick_xml::Reader::from_reader(xml.as_slice());
    let mut buffer = Vec::new();
    let mut output = String::new();
    loop {
        match reader
            .read_event_into(&mut buffer)
            .map_err(|_| "This DOCX document body contains invalid XML.".to_string())?
        {
            Event::Text(text) => {
                let encoded = text.as_ref();
                let decoded = quick_xml::escape::unescape(encoded)
                    .map_err(|_| "This DOCX contains invalid text encoding.".to_string())?;
                if output.len().saturating_add(decoded.len()) > MAX_EXTRACTED_BYTES {
                    return Err("Extracted text is larger than the 1 MiB per-source limit.".into());
                }
                output.push_str(&decoded);
            }
            Event::GeneralRef(reference) => {
                let value = match reference
                    .resolve_char_ref()
                    .map_err(|_| "This DOCX contains an invalid character reference.".to_string())?
                {
                    Some(character) => character.to_string(),
                    None => match reference.as_ref() {
                        "amp" => "&".into(),
                        "lt" => "<".into(),
                        "gt" => ">".into(),
                        "apos" => "'".into(),
                        "quot" => "\"".into(),
                        _ => return Err("This DOCX contains an unsupported text entity.".into()),
                    },
                };
                if output.len().saturating_add(value.len()) > MAX_EXTRACTED_BYTES {
                    return Err("Extracted text is larger than the 1 MiB per-source limit.".into());
                }
                output.push_str(&value);
            }
            Event::End(end) if end.name().as_ref() == "w:p" => output.push('\n'),
            Event::Eof => break,
            _ => {}
        }
        buffer.clear();
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    #[test]
    fn text_import_is_utf8_and_hashes_extracted_content() {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("brief.md");
        std::fs::write(&path, "# Goal\nShip safely").unwrap();
        let imported = import_file(&path).unwrap();
        assert_eq!(imported.provenance, "markdown");
        assert_eq!(imported.extracted_text, "# Goal\nShip safely");
        assert_eq!(
            imported.content_hash,
            hex::encode(Sha256::digest(imported.extracted_text.as_bytes()))
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn corrupt_docx_and_invalid_utf8_return_visible_errors() {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&dir).unwrap();
        let docx = dir.join("broken.docx");
        std::fs::write(&docx, b"not a zip").unwrap();
        assert!(import_file(&docx)
            .unwrap_err()
            .contains("corrupt or encrypted"));
        let text = dir.join("invalid.txt");
        std::fs::write(&text, [0xff, 0xfe]).unwrap();
        assert!(import_file(&text).unwrap_err().contains("valid UTF-8"));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn docx_extraction_reads_text_and_decodes_entities_with_expansion_bounds() {
        let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
        archive
            .start_file(
                "word/document.xml",
                zip::write::SimpleFileOptions::default(),
            )
            .unwrap();
        archive.write_all(b"<w:document xmlns:w=\"w\"><w:body><w:p><w:r><w:t>Release &amp; verify</w:t></w:r></w:p></w:body></w:document>").unwrap();
        let bytes = archive.finish().unwrap().into_inner();
        assert_eq!(extract_docx(&bytes).unwrap().trim(), "Release & verify");
    }

    #[test]
    fn text_pdf_extraction_preserves_page_references() {
        let content = "BT /F1 18 Tf 72 720 Td (Polar PDF brief) Tj ET";
        let objects = vec![
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>".to_string(),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
            format!("<< /Length {} >>\nstream\n{}\nendstream", content.len(), content),
        ];
        let mut pdf = String::from("%PDF-1.4\n");
        let mut offsets = Vec::new();
        for (index, object) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", index + 1, object));
        }
        let xref = pdf.len();
        pdf.push_str("xref\n0 6\n0000000000 65535 f \n");
        for offset in offsets {
            pdf.push_str(&format!("{offset:010} 00000 n \n"));
        }
        pdf.push_str(&format!(
            "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
        ));
        let pages = pdf_extract::extract_text_from_mem_by_pages(pdf.as_bytes()).unwrap();
        assert_eq!(pages.len(), 1);
        assert!(pages[0].contains("Polar PDF brief"));
    }
}
