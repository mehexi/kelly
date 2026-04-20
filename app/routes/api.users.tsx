import prisma from "../db.server";

export async function loader() {
  const users = await prisma.subscriber.findMany();
  return Response.json(users);  // ✅
}
