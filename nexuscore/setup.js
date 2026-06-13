const fs = require('fs');
const path = require('path');

const root = __dirname;

function copyEnvIfMissing(example, target) {
  const examplePath = path.join(root, example);
  const targetPath = path.join(root, target);

  if (fs.existsSync(targetPath)) return false;

  if (!fs.existsSync(examplePath)) {
    console.warn(`Missing template: ${example}`);
    return false;
  }

  fs.copyFileSync(examplePath, targetPath);
  console.log(`Created ${target} from ${example}`);
  return true;
}

const createdEnv = copyEnvIfMissing('.env.example', '.env');
copyEnvIfMissing('client/.env.example', 'client/.env');

if (createdEnv) {
  console.log('');
  console.log('Edit nexuscore/.env and set DB_PASSWORD if your MySQL root user has one.');
  console.log('For remote testing (3 laptops): use start-site-network.bat and set PUBLIC_API_URL in .env');
  console.log('Then run: npm run seed');
  console.log('');
}
