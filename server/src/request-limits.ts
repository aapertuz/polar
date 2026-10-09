// Source text is bounded to 1 MiB before JSON encoding. Escaped control
// characters can expand to six bytes each, so keep this request cap bounded
// while allowing the full validated source through Fastify's parser.
export const EXTRACTED_SOURCE_BODY_LIMIT = 6 * 1024 * 1024;

// The desktop accepts up to 2 MiB of plan JSON. Scheduling adds dates and
// assumptions before submission; reserve space for that patch and the envelope.
export const REASONING_RESULT_BODY_LIMIT = 2 * 1024 * 1024 + 64 * 1024;
