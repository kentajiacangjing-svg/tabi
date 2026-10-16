import { get, insert, newId, now } from "./db";
import { ActionError, createSession, hashPassword } from "./auth";

/** Creates a customer account and signs it in. Used by /signup and inline at the end of the diagnosis. */
export async function createCustomer(input: { name: string; email: string; password: string }) {
  const email = input.email.toLowerCase();
  if (get("SELECT 1 FROM users WHERE email = ?", email)) {
    throw new ActionError("このメールアドレスは既に登録されています。ログインしてから続けてください。");
  }
  const id = newId("usr");
  insert("users", { id, email, name: input.name, role: "customer", password_hash: hashPassword(input.password), created_at: now() });
  await createSession(id);
  return id;
}
