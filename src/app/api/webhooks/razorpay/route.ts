/**
 * Razorpay Webhook — Credit Purchase Handler
 * Receives payment confirmation from Razorpay and adds Sarvagya credits.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addCredits } from '@/lib/sarvagya/credits';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

function verifySignature(body: string, signature: string): boolean {
    if (!RAZORPAY_WEBHOOK_SECRET)
  return false;
    const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
    );
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.text();
        const signature = req.headers.get('x-razorpay-signature') || '';

        if (!verifySignature(body, signature)) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        const event = JSON.parse(body);

        if (event.event === 'payment.captured') {
            const payment = event.payload?.payment?.entity;
            const userId = payment?.notes?.user_id;
            const creditsAmount = parseInt(payment?.notes?.credits_amount || '0', 10);

            if (!userId || !creditsAmount) {
                return NextResponse.json({ error: 'Missing user_id or credits_amount in notes' }, { status: 400 });
            }

            const result = await addCredits(userId, creditsAmount, `Razorpay payment ${payment.id}`);

            console.log(`💳 Razorpay payment captured: ${payment.id} → ${creditsAmount} credits for ${userId}`);

            return NextResponse.json({ success: true, newBalance: result.newBalance });
        }

        // Acknowledge but ignore unhandled events
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('❌ Razorpay webhook error:', error);
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 },
        );
    }
}
