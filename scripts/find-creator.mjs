import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const byToken = await p.creator.findFirst({ where: { sessionToken: 'cmpwfeytk00047t2jpbl7s564' } });
const byUsername = await p.creator.findFirst({ where: { usernameTikTok: 'ciaayogalang' } });

console.log('By token:', byToken);
console.log('By username:', byUsername);
await p.$disconnect();
