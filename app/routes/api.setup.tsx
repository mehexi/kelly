import prisma from "../db.server";

export async function action({ request }: { request: Request }) {
  const { email, first_name, last_name, amount, plan_name, interval } =
    await request.json();

  // 1. Create plan if needed
  let planCode = null;
  if (plan_name && interval) {
    const planRes = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: plan_name, interval, amount }),
    });
    const planData = await planRes.json();
    planCode = planData.data.plan_code;
  }

  // 2. Create Paystack customer
  const customerRes = await fetch("https://api.paystack.co/customer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, first_name, last_name }),
  });
  const customerData = await customerRes.json();

  // 3. Save to DB
  const user = await prisma.subscriber.create({
    data: {
      email,
      firstName: first_name,
      lastName: last_name,
      customerCode: customerData.data.customer_code,
      planCode,
      planName: plan_name || null,
      status: "pending",
    },
  });

  // 4. Initialize payment
  const paymentRes = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, amount }),
    }
  );
  const paymentData = await paymentRes.json();

  return Response.json({
    userId: user.id,
    customer_code: customerData.data.customer_code,
    payment_url: paymentData.data.authorization_url,
  });
}
