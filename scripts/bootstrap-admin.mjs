const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
const secret = process.env.BOOTSTRAP_ADMIN_SECRET;
const fullName = process.env.ADMIN_FULL_NAME;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!appUrl || !secret || !fullName || !email || !password) {
  console.error("Missing APP_URL/NEXT_PUBLIC_APP_URL, BOOTSTRAP_ADMIN_SECRET, ADMIN_FULL_NAME, ADMIN_EMAIL or ADMIN_PASSWORD.");
  process.exit(1);
}

const response = await fetch(`${appUrl.replace(/\/$/, "")}/api/bootstrap-admin`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-bootstrap-secret": secret
  },
  body: JSON.stringify({
    full_name: fullName,
    email,
    password
  })
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(payload.error || `Bootstrap failed with ${response.status}`);
  process.exit(1);
}

console.log(`Admin ready: ${email}`);
