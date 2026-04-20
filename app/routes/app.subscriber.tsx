import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  return Response.json({ subscribers });
};

export default function SubscribersPage() {
  const { subscribers } = useLoaderData();

  return (
    <s-page heading="Subscribers">
      <s-section>
        {subscribers.length === 0 ? (
          <s-box padding="large-500">
            <s-stack direction="block" alignItems="center" gap="base">
              <s-heading accessibilityRole="none">No subscribers yet</s-heading>
              <s-text color="subdued">
                Subscribers will appear here after their first payment.
              </s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Email</s-table-header>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Amount</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Subscribed</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {subscribers.map((sub: any) => (
                <s-table-row key={sub.id}>
                  <s-table-cell>
                    {sub.firstName} {sub.lastName}
                  </s-table-cell>
                  <s-table-cell>{sub.email}</s-table-cell>
                  <s-table-cell>{sub.plan?.name ?? sub.planName ?? "—"}</s-table-cell>
                  <s-table-cell>
                    {sub.plan
                      ? `${sub.plan.currency} ${(sub.plan.amount / 100).toLocaleString()}`
                      : "—"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={
                        sub.status === "active"
                          ? "success"
                          : sub.status === "pending"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {sub.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
