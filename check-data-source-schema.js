const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  notionVersion: '2025-09-03'
});

async function checkDataSourceSchema() {
  console.log('Checking Daily Ritual Data Source Schema...\n');

  try {
    // Query a few pages to see their properties
    const response = await notion.dataSources.query({
      data_source_id: process.env.NOTION_DAILY_RITUAL_DB,
      page_size: 3
    });

    console.log(`Found ${response.results.length} pages\n`);

    if (response.results.length > 0) {
      const firstPage = response.results[0];
      console.log('='.repeat(60));
      console.log('PROPERTY NAMES AND TYPES:');
      console.log('='.repeat(60));

      Object.entries(firstPage.properties).forEach(([name, prop]) => {
        console.log(`\n📌 "${name}"`);
        console.log(`   Type: ${prop.type}`);

        // Show sample value
        if (prop.type === 'title' && prop.title?.[0]) {
          console.log(`   Sample: "${prop.title[0].plain_text}"`);
        } else if (prop.type === 'rich_text' && prop.rich_text?.[0]) {
          const preview = prop.rich_text[0].plain_text.substring(0, 50);
          console.log(`   Sample: "${preview}${prop.rich_text[0].plain_text.length > 50 ? '...' : ''}"`);
        } else if (prop.type === 'date' && prop.date) {
          console.log(`   Sample: ${prop.date.start}${prop.date.end ? ' to ' + prop.date.end : ''}`);
        } else if (prop.type === 'formula' && prop.formula) {
          console.log(`   Formula Type: ${prop.formula.type}`);
          if (prop.formula.type === 'date' && prop.formula.date) {
            console.log(`   Result: ${prop.formula.date.start}`);
          } else if (prop.formula.type === 'string') {
            console.log(`   Result: "${prop.formula.string}"`);
          } else if (prop.formula.type === 'number') {
            console.log(`   Result: ${prop.formula.number}`);
          }
        }
      });

      console.log('\n' + '='.repeat(60));
      console.log('ALL PROPERTY NAMES:');
      console.log('='.repeat(60));
      Object.keys(firstPage.properties).forEach(name => {
        console.log(`  - "${name}"`);
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
  }
}

checkDataSourceSchema();
