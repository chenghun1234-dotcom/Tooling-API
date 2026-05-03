use wasm_bindgen::prelude::*;
use regex::Regex;
use lazy_static::lazy_static;
use serde::{Serialize, Deserialize};

lazy_static! {
    static ref EMAIL_RE: Regex = Regex::new(r"(?i)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?").unwrap();
    static ref PHONE_RE: Regex = Regex::new(r"(\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4})").unwrap();
    static ref KR_RRN_RE: Regex = Regex::new(r"(\d{6}[-.\s]?[1-4]\d{6})").unwrap();
    static ref CREDIT_CARD_RE: Regex = Regex::new(r"(\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4})").unwrap();
    static ref IP_RE: Regex = Regex::new(r"(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}").unwrap();
    
    // New Patterns
    static ref KR_ADDR_RE: Regex = Regex::new(r"(서울|경기|인천|강원|충북|충남|전북|전남|경북|경남|제주|세종시|부산|대구|광주|대전|울산)\s([가-힣]+(?:시|군|구))\s[가-힣\d\s-]+(?:길|로|동|번지)").unwrap();
    static ref PASSPORT_RE: Regex = Regex::new(r"[A-Z][0-9]{8}").unwrap(); // Simplified passport
    static ref KR_NAME_RE: Regex = Regex::new(r"[가-힣]{2,4}(?:\s?님|\s?대표|\s?씨|\s?팀장|\s?주임|\s?과장|\s?차장|\s?부장)").unwrap(); // Context-based name
}

#[derive(Serialize, Deserialize)]
pub struct ScrubConfig {
    pub mask_email: bool,
    pub mask_phone: bool,
    pub mask_rrn: bool,
    pub mask_address: bool,
    pub mask_name: bool,
    pub mask_credit_card: bool,
    pub mask_ip: bool,
    pub mask_passport: bool,
}

#[derive(Serialize)]
pub struct ScrubResult {
    pub scrubbed_text: String,
    pub pii_count: usize,
    pub categories: Vec<String>,
}

#[wasm_bindgen]
pub fn scrub_text_custom(input: &str, config_json: &str) -> String {
    let config: ScrubConfig = serde_json::from_str(config_json).unwrap_or(ScrubConfig {
        mask_email: true, mask_phone: true, mask_rrn: true, mask_address: true,
        mask_name: true, mask_credit_card: true, mask_ip: true, mask_passport: true,
    });

    let mut result = input.to_string();
    let mut pii_count = 0;
    let mut categories = Vec::new();

    // 1. Addresses
    if config.mask_address && KR_ADDR_RE.is_match(&result) {
        pii_count += KR_ADDR_RE.find_iter(&result).count();
        result = KR_ADDR_RE.replace_all(&result, "[ADDRESS]").to_string();
        categories.push("address".to_string());
    }

    // 2. RRN
    if config.mask_rrn && KR_RRN_RE.is_match(&result) {
        pii_count += KR_RRN_RE.find_iter(&result).count();
        result = KR_RRN_RE.replace_all(&result, "[RRN]").to_string();
        categories.push("rrn".to_string());
    }

    // 3. Emails
    if config.mask_email && EMAIL_RE.is_match(&result) {
        pii_count += EMAIL_RE.find_iter(&result).count();
        result = EMAIL_RE.replace_all(&result, "[EMAIL]").to_string();
        categories.push("email".to_string());
    }

    // 4. Credit Cards
    if config.mask_credit_card && CREDIT_CARD_RE.is_match(&result) {
        pii_count += CREDIT_CARD_RE.find_iter(&result).count();
        result = CREDIT_CARD_RE.replace_all(&result, "[CARD]").to_string();
        categories.push("credit_card".to_string());
    }

    // 5. Phone Numbers
    if config.mask_phone && PHONE_RE.is_match(&result) {
        pii_count += PHONE_RE.find_iter(&result).count();
        result = PHONE_RE.replace_all(&result, "[PHONE]").to_string();
        categories.push("phone".to_string());
    }

    // 6. IP Addresses
    if config.mask_ip && IP_RE.is_match(&result) {
        pii_count += IP_RE.find_iter(&result).count();
        result = IP_RE.replace_all(&result, "[IP]").to_string();
        categories.push("ip".to_string());
    }

    // 7. Passports
    if config.mask_passport && PASSPORT_RE.is_match(&result) {
        pii_count += PASSPORT_RE.find_iter(&result).count();
        result = PASSPORT_RE.replace_all(&result, "[PASSPORT]").to_string();
        categories.push("passport".to_string());
    }

    // 8. Names
    if config.mask_name && KR_NAME_RE.is_match(&result) {
        pii_count += KR_NAME_RE.find_iter(&result).count();
        result = KR_NAME_RE.replace_all(&result, "[NAME]").to_string();
        categories.push("name".to_string());
    }

    let final_result = ScrubResult {
        scrubbed_text: result,
        pii_count,
        categories,
    };

    serde_json::to_string(&final_result).unwrap()
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.1.0".to_string()
}
