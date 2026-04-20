import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");

  if (!shop) {
    return Response.json(
      { error: "Missing shop" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const shopifyGid = productId
    ? `gid://shopify/Product/${productId}`
    : null;

  const plans = await prisma.plan.findMany({
    where: {
      shop,
      isActive: true,
      ...(shopifyGid && {
        product: { shopifyId: shopifyGid },
      }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      currency: true,
      interval: true,
      paystackPlanCode: true,
    },
  });

  return Response.json({ plans }, { headers: CORS_HEADERS });
}
