import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const creators = await p.creator.findMany({
  select: { id: true, name: true, usernameTikTok: true, sessionToken: true },
  take: 5,
});
console.log(JSON.stringify(creators, null, 2));
await p.$disconnect();
