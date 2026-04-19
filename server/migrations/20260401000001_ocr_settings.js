/**
 * Migration: OCR pre-processing settings keys
 *
 * Adds settings keys for optional GLM-OCR (Ollama) pre-processing of PDF imports.
 * Uses Ollama's native /api/generate endpoint (not OpenAI-compatible).
 */
exports.up = async function (knex) {
  const defaults = [
    { key: 'llm.ocr_enabled',    value: 'false'   },
    { key: 'llm.ocr_base_url',   value: 'http://vibe-glm-ocr:8090' },
    { key: 'llm.ocr_model',      value: 'glm-ocr'  },
    { key: 'llm.ocr_timeout_ms', value: '120000'   }, // 2 min per page
  ];

  for (const row of defaults) {
    const exists = await knex('settings').where({ key: row.key }).first('key');
    if (!exists) {
      await knex('settings').insert({ key: row.key, value: row.value });
    }
  }
};

exports.down = async function (knex) {
  await knex('settings').whereIn('key', [
    'llm.ocr_enabled',
    'llm.ocr_base_url',
    'llm.ocr_model',
    'llm.ocr_timeout_ms',
  ]).delete();
};
