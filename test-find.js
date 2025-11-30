const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function testFindPage() {
    const date = '2025-01-01';
    console.log(`Testing finding page for date: ${date}`);
    console.log(`Using Data Source ID: ${process.env.NOTION_DAILY_RITUAL_DB}`);

    try {
        const response = await notion.dataSources.query({
            data_source_id: process.env.NOTION_DAILY_RITUAL_DB,
            filter: {
                property: 'Date on Daily RItual',
                date: {
                    equals: date,
                },
            },
            page_size: 1,
        });

        console.log(`Found ${response.results.length} pages.`);

        if (response.results.length > 0) {
            const page = response.results[0];
            console.log('Page ID:', page.id);
            console.log('Current Plan:', JSON.stringify(page.properties['Daily Plan']?.rich_text));
            console.log('Current Reality:', JSON.stringify(page.properties['Daily Reality']?.rich_text));
        } else {
            console.log('❌ Page not found! This explains why update fails (it tries to create new one).');

            // If not found, let's see if we can find it by title just in case
            console.log('\nTrying to find by title...');
            // Note: Title filter might be different depending on property name
        }
    } catch (error) {
        console.error('✗ Error:', error.message);
        console.error(JSON.stringify(error, null, 2));
    }
}

testFindPage();
