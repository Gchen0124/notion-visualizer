const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function checkProperties() {
    console.log('Checking database properties...');
    try {
        // We can't retrieve database properties from a data_source directly in the same way as a database
        // But we can query a page and see its properties
        const response = await notion.dataSources.query({
            data_source_id: process.env.NOTION_DAILY_RITUAL_DB,
            page_size: 1,
        });

        if (response.results.length > 0) {
            const page = response.results[0];
            console.log('✓ Found a page. Properties available:');
            console.log(JSON.stringify(Object.keys(page.properties), null, 2));

            // Check specific properties we care about
            const planProp = page.properties['Daily Plan'];
            const realityProp = page.properties['Daily Reality'];
            const dateProp = page.properties['Date on Daily RItual'];

            console.log('\nProperty Details:');
            console.log('- Daily Plan:', planProp ? `Found (${planProp.type})` : 'MISSING ❌');
            console.log('- Daily Reality:', realityProp ? `Found (${realityProp.type})` : 'MISSING ❌');
            console.log('- Date on Daily RItual:', dateProp ? `Found (${dateProp.type})` : 'MISSING ❌');
        } else {
            console.log('⚠ No pages found in database to check properties.');
        }
    } catch (error) {
        console.error('✗ Error:', error.message);
    }
}

checkProperties();
