// app/routes/api.webhook.tsx
import crypto from "crypto";
import prisma from "../db.server";

export async function action({ request }: { request: Request }) {
  const body = await request.text();

  // Verify Paystack signature
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

  if (hash !== request.headers.get("x-paystack-signature")) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.event === "charge.success") {
    const email = event.data.customer.email;
    const auth = event.data.authorization.authorization_code;

    const user = await prisma.subscriber.findUnique({ where: { email } });
    if (!user) return Response.json({ received: true });

    // Create subscription on Paystack
    const subRes = await fetch("https://api.paystack.co/subscription", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: user.customerCode,
        plan: user.planCode,
        authorization: auth,
      }),
    });
    const subData = await subRes.json();

    // Update user in DB
    await prisma.subscriber.update({
      where: { email },
      data: {
        authorizationCode: auth,
        subscriptionCode: subData.data.subscription_code,
        status: "active",
      },
    });
  }

  return Response.json({ received: true });
}
