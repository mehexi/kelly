// app/routes/_index.tsx
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { useState } from "react";
import { CreatePlan } from "app/componants/CreatePlan";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const total = await prisma.subscriber.count();
  const active = await prisma.subscriber.count({ where: { status: "active" } });
  const pending = await prisma.subscriber.count({ where: { status: "pending" } });
  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: true },
  });
  return Response.json({ total, active, pending, plans });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create-plan") {
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const amount = Number(formData.get("amount"));
    const interval = formData.get("interval") as string;
    const currency = formData.get("currency") as string;
    const productId = formData.get("productId") as string;       // Shopify GID
    const productTitle = formData.get("productTitle") as string;
    const productHandle = formData.get("productHandle") as string;

    if (!name || !amount || !interval || !productId || !productTitle) {
      return Response.json(
        { error: "Name, amount, interval and product are required." },
        { status: 400 }
      );
    }

    // Check if product already has a plan
    const existingProduct = await prisma.product.findUnique({
      where: { shop_shopifyId: { shop: session.shop, shopifyId: productId } },
    });

    if (existingProduct) {
      const existingPlan = await prisma.plan.findUnique({
        where: { productId: existingProduct.id },
      });
      if (existingPlan) {
        return Response.json(
          { error: "This product already has a plan assigned." },
          { status: 409 }
        );
      }
    }

    try {
      const paystackRes = await fetch("https://api.paystack.co/plan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          amount: amount * 100,
          interval,
          currency,
        }),
      });

      const paystackData = await paystackRes.json();

      if (!paystackData.status) {
        return Response.json({ error: paystackData.message }, { status: 400 });
      }

      // Upsert product
      const product = await prisma.product.upsert({
        where: { shop_shopifyId: { shop: session.shop, shopifyId: productId } },
        update: { title: productTitle, handle: productHandle ?? null },
        create: {
          shop: session.shop,
          shopifyId: productId,
          title: productTitle,
          handle: productHandle ?? null,
        },
      });

      // Create plan linked to product
      await prisma.plan.create({
        data: {
          shop: session.shop,
          name,
          description,
          amount: amount * 100,
          interval,
          currency,
          paystackPlanCode: paystackData.data.plan_code,
          paystackPlanId: String(paystackData.data.id),
          isActive: true,
          productId: product.id,
        },
      });

      return Response.json({ success: true });
    } catch (error) {
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Invalid intent." }, { status: 400 });
};

export default function Index() {
  const { total, active, pending, plans } = useLoaderData();
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => setPlanOpen(true)}
      >
        Create Plan
      </s-button>

      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr 1fr" gap="base">
          <s-box padding="base" border="base" borderRadius="base">
            <s-text>Total Subscribers</s-text>
            <s-heading>{total}</s-heading>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base">
            <s-text>Active</s-text>
            <s-heading>{active}</s-heading>
          </s-box>
          <s-box padding="base" border="base" borderRadius="base">
            <s-text>Pending</s-text>
            <s-heading>{pending}</s-heading>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Plans">
        {plans.length === 0 ? (
          <s-box padding="large-500">
            <s-stack direction="block" alignItems="center" gap="base">
              <s-icon type="plan" size="base" />
              <s-heading accessibilityRole="none">No plans yet</s-heading>
              <s-text color="subdued">
                Create your first plan to start accepting subscriptions.
              </s-text>
              <s-button variant="primary" onClick={() => setPlanOpen(true)}>
                Create Plan
              </s-button>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>Plan Name</s-table-header>
              <s-table-header>Amount</s-table-header>
              <s-table-header>Interval</s-table-header>
              <s-table-header>Currency</s-table-header>
              <s-table-header>Paystack Code</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Created</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {plans.map((plan: any) => (
                <s-table-row key={plan.id}>
                  <s-table-cell>{plan.product?.title ?? "—"}</s-table-cell>
                  <s-table-cell>{plan.name}</s-table-cell>
                  <s-table-cell>
                    {(plan.amount / 100).toLocaleString()} {plan.currency}
                  </s-table-cell>
                  <s-table-cell>{plan.interval}</s-table-cell>
                  <s-table-cell>{plan.currency}</s-table-cell>
                  <s-table-cell>{plan.paystackPlanCode ?? "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={plan.isActive ? "success" : "neutral"}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <CreatePlan open={planOpen} onHide={() => setPlanOpen(false)} action="." />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
