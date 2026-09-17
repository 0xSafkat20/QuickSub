import { lazy, Suspense } from "react";
const Page = lazy(() =>
  window.location.pathname === "/admin" ||
  window.location.pathname.startsWith("/admin/")
    ? import("./admin/AdminApp")
    : import("./App"),
);
export default function Root() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center text-brand-600">
          Loading QuickSub…
        </div>
      }
    >
      <Page />
    </Suspense>
  );
}
