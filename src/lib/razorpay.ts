const RAZORPAY_BASE = 'https://api.razorpay.com/v2';
const authHeader = 'Basic ' + Buffer.from(
  `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
).toString('base64');

export async function createLinkedAccount(payload: object) {
  const res = await fetch(`${RAZORPAY_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Razorpay account creation failed: ${await res.text()}`);
  return res.json();
}

export async function createOnboardingLink(accountId: string, stakeholderName: string) {
  // 1. Add a stakeholder (director/owner)
  const stakeholderRes = await fetch(`${RAZORPAY_BASE}/accounts/${accountId}/stakeholders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      name: stakeholderName,
    }),
  });
  
  if (!stakeholderRes.ok) {
    console.warn(`Stakeholder creation failed, but continuing: ${await stakeholderRes.text()}`);
  }

  // Request Route product
  const productRes = await fetch(`${RAZORPAY_BASE}/accounts/${accountId}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      product_name: "route",
      tnc_accepted: true
    }),
  });

  if (!productRes.ok) {
    throw new Error(`Razorpay product request failed: ${await productRes.text()}`);
  }

  const productData = await productRes.json();
  
  // We need the activation URL if present. Wait, typically it's returned as something like productData.activation_url or similar, or we return null.
  // The user says "The onboarding URL comes out of step 2's response."
  // Usually it is `productData.activation_url` or `productData.onboarding_url`
  return productData;
}
