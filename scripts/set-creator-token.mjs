import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

await p.creator.update({
  where: { id: 'cmpwbquph000puar660jnnb9z' },
  data: {
    usernameTikTok: 'ciaayogalang',
    sessionToken: 'cmpwfeytk00047t2jpbl7s564',
  },
});

console.log('Done. Creator portal URL: http://localhost:3000/creator/s/ciaayogalang/cmpwfeytk00047t2jpbl7s564');
await p.$disconnect();
