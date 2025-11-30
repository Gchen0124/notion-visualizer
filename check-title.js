const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function checkTitle() {
    const date = '2025-01-01';
    console.log(`Checking title for date: ${date}`);

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

        if (response.results.length > 0) {
            const page = response.results[0];
            const titleProp = page.properties['date（daily ritual object）'];

            console.log('Page ID:', page.id);
            console.log('Title Property Structure:', JSON.stringify(titleProp, null, 2));

            if (titleProp.title && titleProp.title.length > 0) {
                console.log('Actual Title Value:', titleProp.title[0].plain_text);
            } else {
                console.log('Title is empty');
            }
        } else {
            console.log('Page not found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkTitle();
