import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return Response.json(
    { publicKey: process.env.PAYSTACK_PUBLIC_KEY },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
};
