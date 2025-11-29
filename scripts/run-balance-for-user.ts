import { prisma } from '../lib/db/db';
import { askBalanceQuestion } from '../lib/jobs/balanceJob';

async function main() {
  const phone = process.argv[2] || '+13477224114';
  
  const user = await prisma.user.findFirst({ 
    where: { phone: { contains: phone.replace(/\D/g, '').slice(-10) } }, 
    select: { id: true, phone: true, pendingJobType: true } 
  });
  
  if (!user) {
    console.log('User not found for phone:', phone);
    return;
  }
  
  console.log('Found user:', user);
  const result = await askBalanceQuestion(user.id);
  console.log('Result:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
