const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Reading .env file...');
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = { ...process.env };

// envContent.split('\n').forEach(line => {
//     const match = line.match(/^([^=]+)=(.*)$/);
//     if (match) {
//         let value = match[2].trim();
//         if (value.startsWith('"') && value.endsWith('"')) {
//             value = value.slice(1, -1);
//         }
//         env[match[1].trim()] = value;
//     }
// });

// Hardcode for reliability testing (using SQL Auth to bypass validation issues)
env.DATABASE_URL = "sqlserver://localhost:1433;database=DMS;user=sa;password=Password123!;trustServerCertificate=true";

console.log('Running prisma generate...');
try {
    execSync('npx prisma generate', {
        env,
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..')
    });
    console.log('Success!');
} catch (error) {
    console.error('Failed to generate prisma client');
    process.exit(1);
}
