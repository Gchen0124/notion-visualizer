// Test the Next.js API endpoint directly
const testDate = '2025-01-01';
const testContent = 'API Test from test-api-endpoint.js ' + new Date().toISOString();

async function testUpdateEndpoint() {
    console.log('Testing API endpoint: POST /api/daily-ritual/update');
    console.log(`Date: ${testDate}`);
    console.log(`Type: reality`);
    console.log(`Content: "${testContent}"`);
    console.log('');

    try {
        const response = await fetch('http://localhost:3000/api/daily-ritual/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                date: testDate,
                type: 'reality',
                content: testContent,
            }),
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);

        const result = await response.json();
        console.log('Response body:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ UPDATE SUCCESSFUL');
        } else {
            console.log('❌ UPDATE FAILED:', result.error);
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

testUpdateEndpoint();
