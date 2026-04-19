/**
 * Migration: Backfill default OCR base URL
 *
 * The original 20260401000001_ocr_settings migration seeded `llm.ocr_base_url`
 * as an empty string. The default has since been changed to the bundled
 * vibe-glm-ocr Docker service so admins see a working URL the first time they
 * open the OCR Pre-processing card. Update existing empty rows; leave any
 * admin-customized value alone.
 */
exports.up = async function (knex) {
  await knex('settings')
    .where({ key: 'llm.ocr_base_url' })
    .andWhere(function () {
      this.where('value', '').orWhereNull('value');
    })
    .update({ value: 'http://vibe-glm-ocr:8090' });
};

exports.down = async function (knex) {
  await knex('settings')
    .where({ key: 'llm.ocr_base_url', value: 'http://vibe-glm-ocr:8090' })
    .update({ value: '' });
};
