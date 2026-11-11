import { handlers } from "@/lib/routes";
export const runtime = "nodejs";
export const { GET, POST, DELETE } = handlers("u");
