import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('tax_line_reference').del();
  await knex('tax_line_reference').insert([
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-1a', tax_line_description: 'Gross receipts or sales', form_section: 'Page 1 - Income', sort_order: 100 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-9', tax_line_description: 'Salaries and wages', form_section: 'Page 1 - Deductions', sort_order: 200 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-13', tax_line_description: 'Rent', form_section: 'Page 1 - Deductions', sort_order: 204 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: '1065-15', tax_line_description: 'Interest', form_section: 'Page 1 - Deductions', sort_order: 206 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'K-1', tax_line_description: 'Ordinary business income (loss)', form_section: 'Schedule K', sort_order: 300 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'L-1', tax_line_description: 'Cash', form_section: 'Schedule L - Assets', sort_order: 500 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-1a', tax_line_description: 'Gross receipts or sales', form_section: 'Page 1 - Income', sort_order: 100 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: '1120S-7', tax_line_description: 'Compensation of officers', form_section: 'Page 1 - Deductions', sort_order: 200 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SK-1', tax_line_description: 'Ordinary business income (loss)', form_section: 'Schedule K', sort_order: 300 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'SL-1', tax_line_description: 'Cash', form_section: 'Schedule L - Assets', sort_order: 500 },
    { entity_type: '1065', tax_software: 'ultratax', tax_line_code: 'DONOTMAP', tax_line_description: 'Do Not Map', form_section: 'N/A', sort_order: 9999 },
    { entity_type: '1120S', tax_software: 'ultratax', tax_line_code: 'DONOTMAP', tax_line_description: 'Do Not Map', form_section: 'N/A', sort_order: 9999 },
  ]);
}
