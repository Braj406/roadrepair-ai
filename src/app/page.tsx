// The root URL goes to the dashboard, which sends signed-out visitors to /login.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
