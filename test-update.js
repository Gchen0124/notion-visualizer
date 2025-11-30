const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function testUpdate() {
    const date = '2025-01-01';
    const content = 'Test Update from Script ' + new Date().toISOString();
    console.log(`Testing update for date: ${date}`);
    console.log(`New Content: "${content}"`);

    try {
        // 1. Find the page
        console.log('1. Finding page...');
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

        if (response.results.length === 0) {
            console.error('❌ Page not found!');
            return;
        }

        const page = response.results[0];
        console.log(`✓ Found page: ${page.id}`);

        // 2. Update the page
        console.log('2. Updating page...');
        const updateResponse = await notion.pages.update({
            page_id: page.id,
            properties: {
                'Daily Reality': {
                    rich_text: [
                        {
                            text: {
                                content: content,
                            },
                        },
                    ],
                },
            },
        });

        console.log('✓ Update call successful!');
        console.log('Updated Page ID:', updateResponse.id);

        // 3. Verify the update
        console.log('3. Verifying update...');
        // We can't easily retrieve a single page from a data source by ID using dataSources API without query
        // But let's try to query it again
        const verifyResponse = await notion.dataSources.query({
            data_source_id: process.env.NOTION_DAILY_RITUAL_DB,
            filter: {
                property: 'Date on Daily RItual',
                date: {
                    equals: date,
                },
            },
            page_size: 1,
        });

        const verifyPage = verifyResponse.results[0];
        const newReality = verifyPage.properties['Daily Reality']?.rich_text?.[0]?.plain_text;
        console.log(`Current Reality in DB: "${newReality}"`);

        if (newReality === content) {
            console.log('✅ VERIFICATION SUCCESSFUL: Data matches!');
        } else {
            console.error('❌ VERIFICATION FAILED: Data does not match.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(JSON.stringify(error, null, 2));
    }
}

testUpdate();
