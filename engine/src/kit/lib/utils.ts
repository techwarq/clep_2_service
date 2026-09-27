// Re-exported so components sourced from registries that import
// "@/kit/lib/utils" (Magic UI) and ones that import the "cn" package
// directly (newer shadcn components) both resolve to the same helper.
export { cn } from "cn";
