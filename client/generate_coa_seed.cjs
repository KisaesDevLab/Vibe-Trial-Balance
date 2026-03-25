const XLSX = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.readFile('../BusinessCategoryList.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const catMap = { 'Asset':'assets','Liability':'liabilities','Equity':'equity','Revenue':'revenue','Expenses':'expenses' };

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

const descriptions = {
  'Accommodation and Food Services': 'Hotels, motels, restaurants, bars, and catering businesses.',
  'Administrative and Management Services': 'Office administration, business support, and management consulting services.',
  'Appliance Repairs': 'Household and commercial appliance repair and service businesses.',
  'Arts, Entertainment, and Recreation': 'Performing arts, sports, amusement, and recreation businesses.',
  'Automotive and Small Engine Repairs': 'Auto repair shops, body shops, and small engine service businesses.',
  'Automotive, Equipment Rental and Leasing': 'Vehicle and equipment rental and leasing businesses.',
  'Bookkeeping and Tax Services': 'Bookkeeping, payroll, and tax preparation service providers.',
  'Cleaning Service': 'Residential and commercial cleaning and janitorial service businesses.',
  'Computer and Electronics Repair': 'Computer, phone, and electronics repair service businesses.',
  'Construction': 'General contractors, specialty trade contractors, and construction businesses.',
  'Consulting  and Design Services': 'Business consulting, design, and professional advisory service firms.',
  'Day Care': 'Child care centers, family day care, and after-school programs.',
  'Equipment Rental and Leasing': 'Heavy equipment, tool, and machinery rental and leasing businesses.',
  'Event, Wedding and Party Planning': 'Event coordination, wedding planning, and party organizing businesses.',
  'Farm, Crops and Animals': 'Crop production, livestock, poultry, and mixed farming operations.',
  'Financial Planning, Agents and Brokers': 'Financial advisors, investment planners, and insurance/securities agents.',
  'Graphic Design and Desktop Publishing': 'Graphic design studios and desktop publishing service businesses.',
  'Hairstylist and Barbers': 'Hair salons, barbershops, and personal hair care service businesses.',
  'Health Care and Social Assistance': 'Medical practices, therapy, counseling, and social assistance organizations.',
  'Insurance Agents and Brokers': 'Independent insurance agents, brokers, and related service businesses.',
  'Landscaping': 'Lawn care, landscaping, tree service, and grounds maintenance businesses.',
  'Personal Activities': 'Non-business personal financial activity and miscellaneous personal items.',
  'Personal Services': 'Dry cleaning, laundry, alterations, and other personal care service businesses.',
  'Personal Trainers': 'Fitness training, coaching, and personal wellness service businesses.',
  'Pet Sitting': 'Pet sitting, dog walking, boarding, and animal care service businesses.',
  'Photographer': 'Photography studios, freelance photographers, and video production businesses.',
  'Real Estate Agents and Brokers': 'Real estate sales agents, buyer agents, and real estate brokerage firms.',
  'Real Estate Rental': 'Residential and commercial rental property management and ownership.',
  'Retail and Wholesale Product Sales': 'Retail stores, online sellers, and wholesale product distribution businesses.',
  'Ride-Sharing Driver': 'Rideshare and gig transportation drivers operating personal vehicles.',
  'Secondhand Stores': 'Thrift stores, resale shops, consignment, and used goods retail businesses.',
  'Website Design and Development': 'Web design agencies, developers, and digital product creation businesses.',
};

const templateMap = new Map();
data.slice(1).forEach((row, i) => {
  const [bizType, acctNum, categoryTxt, subAccountOf, categoryTypeID, type] = row;
  if (!bizType || !acctNum) return;
  if (!templateMap.has(bizType)) templateMap.set(bizType, []);
  templateMap.get(bizType).push({
    account_number: String(acctNum),
    account_name: String(categoryTxt || ''),
    subcategory: subAccountOf ? String(subAccountOf) : null,
    category: catMap[categoryTypeID] || 'expenses',
    normal_balance: String(type || '').toLowerCase() === 'credit' ? 'credit' : 'debit',
    sort_order: i,
  });
});

const EXCLUDED_TEMPLATES = new Set(['Personal Activities']);

const templates = [...templateMap.entries()]
  .filter(([name]) => !EXCLUDED_TEMPLATES.has(name))
  .map(([name, accounts]) => ({
    name, slug: slug(name), description: descriptions[name] || name, accounts,
  }));

const js = `/**
 * Seed 32 system COA templates from BusinessCategoryList.xlsx
 * Run with: npx knex seed:run --specific=007_coa_templates.js
 */
exports.seed = async function(knex) {
  const existing = await knex('coa_templates').where({ is_system: true }).first();
  if (existing) return; // migration 20260321000005 already loaded these

  const templates = ${JSON.stringify(templates, null, 2)};

  for (const t of templates) {
    const [row] = await knex('coa_templates').insert({
      name: t.name,
      description: t.description,
      business_type: t.slug,
      is_system: true,
      is_active: true,
      account_count: t.accounts.length,
    }).returning('id');
    const templateId = row.id;
    if (t.accounts.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < t.accounts.length; i += CHUNK) {
        await knex('coa_template_accounts').insert(
          t.accounts.slice(i, i + CHUNK).map(a => ({
            template_id: templateId,
            account_number: a.account_number,
            account_name: a.account_name,
            subcategory: a.subcategory,
            category: a.category,
            normal_balance: a.normal_balance,
            sort_order: a.sort_order,
            is_active: true,
          }))
        );
      }
    }
  }
};
`;

const outPath = path.join(__dirname, '../server/seeds/007_coa_templates.js');
fs.writeFileSync(outPath, js, 'utf8');
console.log('Seed written:', outPath);
