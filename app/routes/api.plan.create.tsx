// app/routes/api.plan.create.tsx
import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function action({ request }: ActionFunctionArgs) {
  const {
    shop,
    product_id,   // Shopify GID e.g. "gid://shopify/Product/123"
    product_title,
    product_handle,
    plan_name,
    description,
    interval,
    amount,
    currency,
  } = await request.json();

  if (!shop || !product_id || !product_title || !plan_name || !interval || !amount) {
    return Response.json(
      { error: "shop, product_id, product_title, plan_name, interval and amount are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Upsert the product record
  const product = await prisma.product.upsert({
    where: {
      shop_shopifyId: { shop, shopifyId: product_id },
    },
    update: {
      title: product_title,
      handle: product_handle ?? null,
    },
    create: {
      shop,
      shopifyId: product_id,
      title: product_title,
      handle: product_handle ?? null,
    },
  });

  // Check if this product already has a plan
  const existing = await prisma.plan.findUnique({
    where: { productId: product.id },
  });

  if (existing) {
    return Response.json(
      { error: "This product already has a plan assigned." },
      { status: 409, headers: CORS_HEADERS }
    );
  }

  // Create plan on Paystack
  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: plan_name,
      interval,
      amount,
      currency: currency ?? "NGN",
    }),
  });

  const data = await res.json();

  if (!data.status) {
    return Response.json(
      { error: data.message ?? "Failed to create plan on Paystack." },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Save the plan linked to the product
  const plan = await prisma.plan.create({
    data: {
      shop,
      productId: product.id,
      name: data.data.name,
      description: description ?? null,
      amount: data.data.amount,
      currency: currency ?? "NGN",
      interval: data.data.interval,
      paystackPlanCode: data.data.plan_code,
      paystackPlanId: String(data.data.id),
    },
    include: {
      product: true,
    },
  });

  return Response.json(
    { success: true, plan },
    { headers: CORS_HEADERS }
  );
}
