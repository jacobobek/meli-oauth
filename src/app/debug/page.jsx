import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default function DebugPage() {
  const jar = cookies();
  const token = jar.get("meli_access_token")?.value || null;
  const user = jar.get("meli_user_id")?.value || null;

  return (
    <pre style={{ padding: 24 }}>
{`Debug cookies:
- has_access_token: ${token ? "true" : "false"}
- user_id: ${user || "null"}`}
    </pre>
  );
}
