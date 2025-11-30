// Test the fix - try updating an existing page
const testDate = '2025-01-02'; // This page exists with reality: "bunbun"
const testContent = 'Testing fix - should UPDATE existing page, not create duplicate';

async function testFix() {
    console.log('Testing the fix...');
    console.log(`Date: ${testDate}`);
    console.log(`Type: plan`);
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
                type: 'plan',
                content: testContent,
            }),
        });

        const result = await response.json();
        console.log('Response:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ SUCCESS! Page ID:', result.pageId);
            console.log('\nNow check your Notion database:');
            console.log('- You should see ONE page for 2025-01-02');
            console.log('- The plan field should be updated');
            console.log('- The reality field should still say "bunbun"');
        } else {
            console.log('\n❌ FAILED:', result.error);
        }
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    }
}

testFix();
