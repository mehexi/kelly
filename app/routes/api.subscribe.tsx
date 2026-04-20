import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.json();
  const { shop, firstName, lastName, email, planId, planName, planCode, reference } = body;

  try {
    // verify transaction with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return Response.json(
        { error: "Payment verification failed." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const paystackData = verifyData.data;

    // upsert subscriber
    await prisma.subscriber.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        customerCode: paystackData.customer?.customer_code,
        authorizationCode: paystackData.authorization?.authorization_code,
        subscriptionCode: paystackData.subscription_code ?? null,
        planName,
        planCode,
        status: "active",
        planId,
      },
      create: {
        email,
        firstName,
        lastName,
        customerCode: paystackData.customer?.customer_code,
        authorizationCode: paystackData.authorization?.authorization_code,
        subscriptionCode: paystackData.subscription_code ?? null,
        planName,
        planCode,
        status: "active",
        planId,
      },
    });

    return Response.json(
      { success: true },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    return Response.json(
      { error: "Something went wrong." },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
};
