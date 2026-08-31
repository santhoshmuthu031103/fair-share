async function testAllActions() {
  const url = 'https://split-app.santhoshmuthu0311.workers.dev/';
  const actions = [
    {
      secret: 'fairshare2024',
      action: 'expense_added',
      senderName: 'Nalien',
      groupName: 'Trip to Goa',
      description: 'Dinner',
      amount: 1450,
      memberIds: ['test_user_1']
    },
    {
      secret: 'fairshare2024',
      action: 'member_added',
      senderName: 'Nalien',
      groupName: 'Trip to Goa',
      memberIds: ['test_user_2']
    },
    {
      secret: 'fairshare2024',
      action: 'settlement_added',
      senderName: 'Nalien',
      groupName: 'Trip to Goa',
      payeeName: 'Alex',
      amount: 500,
      memberIds: ['test_user_3']
    }
  ];

  for (const payload of actions) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`Action [${payload.action}] response:`, data);
    } catch (e) {
      console.error(`Action [${payload.action}] error:`, e.message);
    }
  }
}

testAllActions();
